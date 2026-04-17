import type { FastifyBaseLogger } from 'fastify'
import { dailyTipSchema } from '@halo/shared'
import { dailyTips } from '../db/schema/daily-tips.js'
import { eq, lt } from 'drizzle-orm'
import type { DrizzleDb } from '../db/types.js'
import type { AiClient } from '../lib/vertex-ai.js'
import { todayDateString, sevenDaysAgoDateString } from '../lib/date-utils.js'

/** Strip HTML tags and control characters from LLM output */
function sanitize(text: string): string {
  return (
    text
      .replace(/<[^>]*>/g, '')
      // eslint-disable-next-line no-control-regex -- intentionally stripping control chars from LLM output
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      .trim()
  )
}

const MAX_TIPS_PER_DAY = 100

export const TIPS_PROMPT = `You are a helpful assistant for Alzheimer's & dementia caregivers.
Generate exactly 50 practical daily tips for caregivers. Each tip should be actionable, compassionate, and specific.

SAFETY GUARDRAILS:
- Do NOT recommend specific medications, dosages, or treatments
- Do NOT provide medical diagnoses or clinical advice
- Focus on practical caregiving, emotional support, and daily routines

Respond with a JSON array of objects, each with "tip" and "category" fields.
Category must be one of: Self Care, Communication, Daily Care, Safety, Emotional, Behavioral.
Keep each tip under 300 characters. No markdown, no extra text — only the JSON array.

Example format:
[{"tip": "Take 10 minutes for yourself today.", "category": "Self Care"}]`

export async function generateDailyTips(
  db: DrizzleDb,
  aiClient: AiClient,
  logger?: FastifyBaseLogger,
): Promise<void> {
  const today = todayDateString()

  // Check if tips already exist for today (idempotency)
  const existing = await db.select().from(dailyTips).where(eq(dailyTips.tipDate, today))

  if (existing.length > 0) {
    logger?.info('Tips already exist for today, skipping generation')
    // Still run cleanup
    await cleanupOldTips(db, logger)
    return
  }

  // Generate tips via Gemini
  const raw = await aiClient.generateContent(TIPS_PROMPT, [
    { role: 'user', parts: [{ text: 'Generate 50 daily caregiving tips for today.' }] },
  ])

  const MAX_RESPONSE_SIZE = 512 * 1024 // 512KB
  if (raw.length > MAX_RESPONSE_SIZE) {
    throw new Error(`Gemini response too large: ${raw.length} bytes`)
  }

  // Strip markdown code fences — Gemini often wraps JSON in ```json ... ```
  const cleaned = raw
    .replace(/^```(?:json)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim()

  if (!cleaned) {
    throw new Error('Gemini returned an empty response — possible safety block or quota limit')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch (err) {
    const preview = cleaned.slice(0, 500)
    logger?.error({ rawPreview: preview }, 'Failed to parse Gemini response as JSON')
    throw new Error(`Gemini response is not valid JSON: ${(err as Error).message}`)
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Gemini response is not an array')
  }

  // Validate and sanitize each tip
  const validTips: Array<{ tip: string; category: string }> = []
  let rejectedCount = 0

  for (const item of parsed) {
    // Sanitize before validation so Zod validates the final form of the data
    const sanitized = {
      tip: typeof item?.tip === 'string' ? sanitize(item.tip) : item?.tip,
      category: item?.category, // Category is enum-validated — no need to sanitize
    }
    const result = dailyTipSchema.safeParse(sanitized)
    if (result.success) {
      validTips.push({ tip: result.data.tip, category: result.data.category })
    } else {
      rejectedCount++
    }
  }

  if (rejectedCount > 0) {
    logger?.warn({ rejectedCount }, `${rejectedCount} tips rejected during validation`)
  }

  if (validTips.length === 0) {
    throw new Error('No valid tips generated from Gemini response')
  }

  // Cap at MAX_TIPS_PER_DAY to prevent runaway LLM output
  const tipsToInsert = validTips.slice(0, MAX_TIPS_PER_DAY)

  // Bulk insert valid tips with today's date
  const rows = tipsToInsert.map((t) => ({
    tip: t.tip,
    category: t.category,
    tipDate: today,
  }))

  await db.insert(dailyTips).values(rows).onConflictDoNothing()

  logger?.info({ count: tipsToInsert.length }, `Inserted ${tipsToInsert.length} tips for ${today}`)

  // Clean up old tips
  await cleanupOldTips(db, logger)
}

async function cleanupOldTips(db: DrizzleDb, logger?: FastifyBaseLogger): Promise<void> {
  try {
    const cutoff = sevenDaysAgoDateString()
    await db.delete(dailyTips).where(lt(dailyTips.tipDate, cutoff))
    logger?.info({ cutoff }, 'Cleaned up tips older than 7 days')
  } catch (err) {
    // Cleanup failure is non-fatal — tips were already generated successfully
    logger?.error({ err }, 'Failed to clean up old tips — will retry next run')
  }
}
