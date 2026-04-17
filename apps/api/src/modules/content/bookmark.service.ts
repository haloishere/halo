import { eq, and, desc, lt, inArray } from 'drizzle-orm'
import type { FastifyBaseLogger } from 'fastify'
import type { DrizzleDb } from '../../db/types.js'
import { stripMarkdown } from './content.service.js'
import { bookmarks } from '../../db/schema/bookmarks.js'
import { contentItems } from '../../db/schema/content-items.js'
import { userContentProgress } from '../../db/schema/user-content-progress.js'

export interface BookmarkToggleResult {
  bookmarked: boolean
}

export interface BookmarkedItem {
  id: string
  title: string
  slug: string
  snippet: string
  category: string
  diagnosisStages: string[]
  videoUrl: string | null
  isBookmarked: boolean
  progressPercent: number | null
  publishedAt: Date | null
  createdAt: Date
}

// ─── Toggle Bookmark ───────────────────────────────────────────────────────────

export async function toggleBookmark(
  db: DrizzleDb,
  userId: string,
  contentItemId: string,
  logger?: FastifyBaseLogger,
): Promise<BookmarkToggleResult> {
  // Insert — ON CONFLICT DO NOTHING avoids TOCTOU race on the unique constraint
  const inserted = await db
    .insert(bookmarks)
    .values({ userId, contentItemId })
    .onConflictDoNothing()
    .returning()

  if (inserted.length > 0) {
    logger?.info({ contentItemId }, 'Bookmark added')
    return { bookmarked: true }
  }

  // Already existed — remove it
  await db
    .delete(bookmarks)
    .where(and(eq(bookmarks.userId, userId), eq(bookmarks.contentItemId, contentItemId)))

  logger?.info({ contentItemId }, 'Bookmark removed')
  return { bookmarked: false }
}

// ─── User Bookmarks ────────────────────────────────────────────────────────────

export async function getUserBookmarks(
  db: DrizzleDb,
  userId: string,
  cursor?: string,
  limit: number = 20,
  logger?: FastifyBaseLogger,
): Promise<{ items: BookmarkedItem[]; nextCursor: string | null }> {
  const conditions = [eq(bookmarks.userId, userId)]

  if (cursor) {
    conditions.push(lt(bookmarks.id, cursor))
  }

  const rows = await db
    .select()
    .from(bookmarks)
    .innerJoin(contentItems, eq(contentItems.id, bookmarks.contentItemId))
    .leftJoin(
      userContentProgress,
      and(
        eq(userContentProgress.contentItemId, contentItems.id),
        eq(userContentProgress.userId, userId),
      ),
    )
    .where(and(...conditions))
    .orderBy(desc(bookmarks.id))
    .limit(limit + 1)

  const hasMore = rows.length > limit
  const results = hasMore ? rows.slice(0, limit) : rows

  const items: BookmarkedItem[] = results.map((row) => ({
    id: row.content_items.id,
    title: row.content_items.title,
    slug: row.content_items.slug,
    snippet: stripMarkdown(row.content_items.body),
    category: row.content_items.category,
    diagnosisStages: row.content_items.diagnosisStages,
    videoUrl: row.content_items.videoUrl,
    isBookmarked: true,
    progressPercent: row.user_content_progress?.progressPercent ?? null,
    publishedAt: row.content_items.publishedAt,
    createdAt: row.content_items.createdAt,
  }))

  const lastRow = results[results.length - 1]
  const nextCursor = hasMore && lastRow ? lastRow.bookmarks.id : null

  logger?.info({ count: items.length, hasMore }, 'Listed user bookmarks')
  return { items, nextCursor }
}

// ─── Batch Status Check ────────────────────────────────────────────────────────

export async function getBookmarkStatuses(
  db: DrizzleDb,
  userId: string,
  contentItemIds: string[],
): Promise<Set<string>> {
  if (contentItemIds.length === 0) return new Set()

  const rows = await db
    .select({ contentItemId: bookmarks.contentItemId })
    .from(bookmarks)
    .where(and(eq(bookmarks.userId, userId), inArray(bookmarks.contentItemId, contentItemIds)))

  return new Set(rows.map((r) => r.contentItemId))
}
