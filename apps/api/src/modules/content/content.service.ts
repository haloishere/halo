import { eq, and, desc, lt, sql, isNotNull } from 'drizzle-orm'
import type { FastifyBaseLogger } from 'fastify'
import type { DrizzleDb } from '../../db/types.js'
import { contentItems } from '../../db/schema/content-items.js'
import { bookmarks } from '../../db/schema/bookmarks.js'
import { userContentProgress } from '../../db/schema/user-content-progress.js'
import type { ContentSearch, CreateContent, UpdateContent } from '@halo/shared'
import { getSignedUrl } from '../../lib/gcs.js'

export type ContentItemRecord = typeof contentItems.$inferSelect

export function stripMarkdown(body: string, maxLength = 200): string {
  const stripped = body
    .replace(/^#{1,6}\s+/gmu, '')
    .replace(/\*{1,2}([^*]+)\*{1,2}/gu, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/gu, '$1')
    .replace(/`([^`]+)`/gu, '$1')
    .replace(/\n+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
  if (stripped.length <= maxLength) return stripped
  return stripped.slice(0, maxLength) + '...'
}

const GCS_CMS_MEDIA_BUCKET = process.env.GCS_CMS_MEDIA_BUCKET

/**
 * Resolve a thumbnail GCS path to a signed URL.
 * Returns the value as-is if it's already a full URL (dev mode) or null.
 * Logger is optional but should be passed from the request context so that
 * signing failures are surfaced via Cloud Logging instead of silently dropping
 * the thumbnail.
 */
async function resolveThumbnailUrl(
  path: string | null,
  logger?: FastifyBaseLogger,
): Promise<string | null> {
  if (!path) return null
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  if (!GCS_CMS_MEDIA_BUCKET) return null
  return getSignedUrl(path, GCS_CMS_MEDIA_BUCKET, logger)
}

export interface ContentListItem {
  id: string
  title: string
  slug: string
  snippet: string
  category: string
  diagnosisStages: string[]
  videoUrl: string | null
  thumbnailUrl: string | null
  isBookmarked: boolean
  progressPercent: number | null
  publishedAt: Date | null
  createdAt: Date
}

export interface ContentDetail extends ContentItemRecord {
  isBookmarked: boolean
  progressPercent: number | null
}

// ─── List Content ──────────────────────────────────────────────────────────────

export async function listContent(
  db: DrizzleDb,
  filters: ContentSearch,
  userId: string,
  logger?: FastifyBaseLogger,
): Promise<{ items: ContentListItem[]; nextCursor: string | null }> {
  const limit = filters.limit ?? 20

  const conditions = [isNotNull(contentItems.publishedAt)]

  if (filters.category) {
    conditions.push(eq(contentItems.category, filters.category))
  }

  if (filters.stage) {
    conditions.push(
      sql`${contentItems.diagnosisStages} @> ARRAY[${filters.stage}]::diagnosis_stage[]`,
    )
  }

  if (filters.search) {
    // Application-level search until FTS migration adds search_vector column
    conditions.push(
      sql`(${contentItems.title} ILIKE ${'%' + filters.search + '%'} OR ${contentItems.body} ILIKE ${'%' + filters.search + '%'})`,
    )
  }

  if (filters.cursor) {
    conditions.push(lt(contentItems.id, filters.cursor))
  }

  const rows = await db
    .select()
    .from(contentItems)
    .leftJoin(
      bookmarks,
      and(eq(bookmarks.contentItemId, contentItems.id), eq(bookmarks.userId, userId)),
    )
    .leftJoin(
      userContentProgress,
      and(
        eq(userContentProgress.contentItemId, contentItems.id),
        eq(userContentProgress.userId, userId),
      ),
    )
    .where(and(...conditions))
    .orderBy(desc(contentItems.id))
    .limit(limit + 1)

  const hasMore = rows.length > limit
  const results = hasMore ? rows.slice(0, limit) : rows

  // Resolve thumbnail signed URLs in parallel
  const thumbnailUrls = await Promise.all(
    results.map((row) => resolveThumbnailUrl(row.content_items.thumbnailUrl, logger)),
  )

  const items: ContentListItem[] = results.map((row, i) => ({
    id: row.content_items.id,
    title: row.content_items.title,
    slug: row.content_items.slug,
    snippet: stripMarkdown(row.content_items.body),
    category: row.content_items.category,
    diagnosisStages: row.content_items.diagnosisStages,
    videoUrl: row.content_items.videoUrl,
    thumbnailUrl: thumbnailUrls[i] ?? null,
    isBookmarked: row.bookmarks !== null,
    progressPercent: row.user_content_progress?.progressPercent ?? null,
    publishedAt: row.content_items.publishedAt,
    createdAt: row.content_items.createdAt,
  }))

  const lastItem = results[results.length - 1]
  const nextCursor = hasMore && lastItem ? lastItem.content_items.id : null

  logger?.info({ count: items.length, hasMore }, 'Listed content')
  return { items, nextCursor }
}

// ─── Get by Slug ───────────────────────────────────────────────────────────────

export async function getContentBySlug(
  db: DrizzleDb,
  slug: string,
  userId: string,
  logger?: FastifyBaseLogger,
): Promise<ContentDetail> {
  const [row] = await db
    .select()
    .from(contentItems)
    .leftJoin(
      bookmarks,
      and(eq(bookmarks.contentItemId, contentItems.id), eq(bookmarks.userId, userId)),
    )
    .leftJoin(
      userContentProgress,
      and(
        eq(userContentProgress.contentItemId, contentItems.id),
        eq(userContentProgress.userId, userId),
      ),
    )
    .where(and(eq(contentItems.slug, slug), isNotNull(contentItems.publishedAt)))
    .limit(1)

  if (!row) {
    throw Object.assign(new Error('Content not found'), { statusCode: 404 })
  }

  const thumbnailUrl = await resolveThumbnailUrl(row.content_items.thumbnailUrl, logger)

  return {
    ...row.content_items,
    thumbnailUrl,
    isBookmarked: row.bookmarks !== null,
    progressPercent: row.user_content_progress?.progressPercent ?? null,
  }
}

// ─── Get by ID (admin, no publishedAt filter) ──────────────────────────────────

export async function getContentById(db: DrizzleDb, id: string): Promise<ContentItemRecord> {
  const [record] = await db.select().from(contentItems).where(eq(contentItems.id, id)).limit(1)

  if (!record) {
    throw Object.assign(new Error('Content not found'), { statusCode: 404 })
  }
  return record
}

// ─── Create ────────────────────────────────────────────────────────────────────

export async function createContent(
  db: DrizzleDb,
  authorId: string,
  data: CreateContent,
  logger?: FastifyBaseLogger,
): Promise<ContentItemRecord> {
  try {
    const rows = await db
      .insert(contentItems)
      .values({
        title: data.title,
        slug: data.slug,
        body: data.body,
        category: data.category,
        diagnosisStages: data.diagnosisStages,
        videoUrl: data.videoUrl ?? null,
        authorId,
        publishedAt: new Date(),
      })
      .returning()

    const record = rows[0]
    if (!record) {
      throw new Error('Failed to create content')
    }

    logger?.info({ contentId: record.id, slug: record.slug }, 'Content created')
    return record
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && err.code === '23505') {
      throw Object.assign(new Error('Content with this slug already exists'), { statusCode: 409 })
    }
    throw err
  }
}

// ─── Update ────────────────────────────────────────────────────────────────────

export async function updateContent(
  db: DrizzleDb,
  id: string,
  data: UpdateContent,
  logger?: FastifyBaseLogger,
): Promise<ContentItemRecord> {
  try {
    const rows = await db.update(contentItems).set(data).where(eq(contentItems.id, id)).returning()

    const record = rows[0]
    if (!record) {
      throw Object.assign(new Error('Content not found'), { statusCode: 404 })
    }

    logger?.info({ contentId: id }, 'Content updated')
    return record
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && err.code === '23505') {
      throw Object.assign(new Error('Content with this slug already exists'), { statusCode: 409 })
    }
    throw err
  }
}

// ─── Delete ────────────────────────────────────────────────────────────────────

export async function deleteContent(
  db: DrizzleDb,
  id: string,
  logger?: FastifyBaseLogger,
): Promise<void> {
  const rows = await db.delete(contentItems).where(eq(contentItems.id, id)).returning()

  if (rows.length === 0) {
    throw Object.assign(new Error('Content not found'), { statusCode: 404 })
  }

  logger?.info({ contentId: id }, 'Content deleted')
}
