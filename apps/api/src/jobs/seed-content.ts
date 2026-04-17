import type { FastifyBaseLogger } from 'fastify'
import { sql } from 'drizzle-orm'
import type { DrizzleDb } from '../db/types.js'
import type { AiClient } from '../lib/vertex-ai.js'
import { contentItems } from '../db/schema/content-items.js'
import { CONTENT_CATEGORIES, type ContentCategory, type DiagnosisStage } from '@halo/shared'

interface GeneratedArticle {
  title: string
  slug: string
  body: string
  category: ContentCategory
  diagnosisStages: DiagnosisStage[]
  videoUrl?: string
}

const BATCH_SIZE = 3 // articles per Gemini call — small to avoid timeouts + rate limits
const DELAY_BETWEEN_BATCHES_MS = 15_000 // 15s between batches
const MAX_RETRIES = 3
const RETRY_BASE_DELAY_MS = 30_000 // 30s base, doubles each retry

const CATEGORY_CONFIG: Record<
  ContentCategory,
  { count: number; label: string; stages: DiagnosisStage[] }
> = {
  understanding_disease: {
    count: 12,
    label: 'Understanding the Disease',
    stages: ['early', 'middle', 'late'],
  },
  daily_care: { count: 12, label: 'Daily Care', stages: ['early', 'middle', 'late'] },
  behavioral_management: { count: 10, label: 'Behavioral Management', stages: ['middle', 'late'] },
  communication: { count: 10, label: 'Communication', stages: ['early', 'middle', 'late'] },
  safety: { count: 10, label: 'Safety', stages: ['middle', 'late'] },
  self_care: { count: 10, label: 'Self Care', stages: ['early', 'middle', 'late'] },
  legal_financial: { count: 8, label: 'Legal & Financial', stages: ['early', 'middle'] },
}

function buildPrompt(count: number, label: string): string {
  return `You are a medical content writer specializing in Alzheimer's and dementia caregiving.

Generate exactly ${count} educational articles for the "${label}" category.
These are for family caregivers (NOT medical professionals).

SAFETY GUARDRAILS:
- Do NOT recommend specific medications, dosages, or treatments
- Do NOT provide medical diagnoses or clinical advice
- Include the disclaimer "This is not medical advice" at the end of each article body
- Focus on practical caregiving, emotional support, and daily routines

Each article must have:
- "title": A clear, descriptive title (5-10 words)
- "slug": URL-friendly version of the title (lowercase, hyphens, no special chars)
- "body": Full article in Markdown format (300-800 words). Include headings, bullet points, and practical tips.

Respond with a JSON array only. No markdown code fences, no extra text.

Example format:
[{"title":"Understanding Sundowning","slug":"understanding-sundowning","body":"# Understanding Sundowning\\n\\nSundowning is..."}]`
}

export function sanitize(text: string): string {
  return (
    text
      .replace(/<[^>]*>/gu, '')
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/gu, '')
      .trim()
  )
}

export function parseArticles(
  raw: string,
  category: ContentCategory,
  stages: DiagnosisStage[],
  logger?: FastifyBaseLogger,
): GeneratedArticle[] {
  const cleaned = raw
    .replace(/^```(?:json)?\s*\n?/iu, '')
    .replace(/\n?```\s*$/iu, '')
    .trim()

  if (!cleaned) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch (err) {
    logger?.error({ err, rawPreview: raw.slice(0, 200) }, 'Failed to parse Gemini response as JSON')
    return []
  }

  if (!Array.isArray(parsed)) return []

  const articles: GeneratedArticle[] = []
  for (const item of parsed) {
    if (
      typeof item?.title === 'string' &&
      typeof item?.slug === 'string' &&
      typeof item?.body === 'string' &&
      item.title.length > 0 &&
      item.slug.length > 0 &&
      item.body.length > 50
    ) {
      articles.push({
        title: sanitize(item.title).slice(0, 200),
        slug: item.slug
          .toLowerCase()
          .replace(/[^a-z0-9-]/gu, '')
          .slice(0, 200),
        body: sanitize(item.body),
        category,
        diagnosisStages: stages,
      })
    }
  }

  return articles
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function generateWithRetry(
  aiClient: AiClient,
  prompt: string,
  userMessage: string,
  logger?: FastifyBaseLogger,
): Promise<string> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await aiClient.generateContent(prompt, [
        { role: 'user', parts: [{ text: userMessage }] },
      ])
    } catch (err: unknown) {
      const is429 =
        err && typeof err === 'object' && 'message' in err &&
        typeof (err as { message: string }).message === 'string' &&
        (err as { message: string }).message.includes('429')
      const isTimeout =
        err && typeof err === 'object' && 'message' in err &&
        typeof (err as { message: string }).message === 'string' &&
        (err as { message: string }).message.includes('timed out')

      if ((is429 || isTimeout) && attempt < MAX_RETRIES) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt)
        logger?.warn(
          { attempt: attempt + 1, delayMs: delay },
          `Rate limited or timed out, retrying in ${delay / 1000}s...`,
        )
        await sleep(delay)
        continue
      }
      throw err
    }
  }
  throw new Error('Unreachable')
}

export async function seedContent(
  db: DrizzleDb,
  aiClient: AiClient,
  logger?: FastifyBaseLogger,
): Promise<void> {
  // Idempotency: skip if content already exists
  const [existing] = await db.select({ count: sql<number>`count(*)::int` }).from(contentItems)

  if (existing && existing.count > 0) {
    logger?.info({ count: existing.count }, 'Content already seeded, skipping')
    return
  }

  let totalInserted = 0

  for (const cat of CONTENT_CATEGORIES) {
    const config = CATEGORY_CONFIG[cat]
    const totalForCategory = config.count
    let insertedForCategory = 0

    logger?.info(
      { category: cat, target: totalForCategory },
      `Generating ${config.label} articles in batches of ${BATCH_SIZE}...`,
    )

    // Split into batches
    for (let batchStart = 0; batchStart < totalForCategory; batchStart += BATCH_SIZE) {
      const batchCount = Math.min(BATCH_SIZE, totalForCategory - batchStart)
      const batchNum = Math.floor(batchStart / BATCH_SIZE) + 1

      // Delay between batches (skip first)
      if (batchStart > 0) {
        logger?.info({ delayMs: DELAY_BETWEEN_BATCHES_MS }, `Waiting ${DELAY_BETWEEN_BATCHES_MS / 1000}s before next batch...`)
        await sleep(DELAY_BETWEEN_BATCHES_MS)
      }

      const prompt = buildPrompt(batchCount, config.label)

      let raw: string
      try {
        raw = await generateWithRetry(
          aiClient,
          prompt,
          `Generate ${batchCount} ${config.label} articles for caregivers (batch ${batchNum}).`,
          logger,
        )
      } catch (err) {
        logger?.error(
          { err, category: cat, batch: batchNum },
          `Failed to generate batch ${batchNum} for ${cat} after retries`,
        )
        continue
      }

      const articles = parseArticles(raw, cat, config.stages)

      if (articles.length === 0) {
        logger?.warn({ category: cat, batch: batchNum }, `No valid articles parsed for batch ${batchNum}`)
        continue
      }

      const rows = articles.map((a) => ({
        title: a.title,
        slug: a.slug,
        body: a.body,
        category: a.category,
        diagnosisStages: a.diagnosisStages,
        videoUrl: a.videoUrl ?? null,
        publishedAt: new Date(),
      }))

      try {
        await db.insert(contentItems).values(rows).onConflictDoNothing()
        insertedForCategory += articles.length
        totalInserted += articles.length
        logger?.info(
          { category: cat, batch: batchNum, count: articles.length, categoryTotal: insertedForCategory },
          `Batch ${batchNum}: inserted ${articles.length} articles`,
        )
      } catch (err) {
        logger?.error({ err, category: cat, batch: batchNum }, `Failed to insert batch ${batchNum}`)
      }
    }

    logger?.info(
      { category: cat, inserted: insertedForCategory, target: totalForCategory },
      `${config.label}: ${insertedForCategory}/${totalForCategory} articles`,
    )
  }

  logger?.info({ totalInserted }, `Content seeding complete: ${totalInserted} articles`)
}
