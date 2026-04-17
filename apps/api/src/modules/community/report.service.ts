import { eq, and, desc, or, lt } from 'drizzle-orm'
import type { FastifyBaseLogger } from 'fastify'
import type { DrizzleDb } from '../../db/types.js'
import type { ReportReason, ReportStatus } from '@halo/shared'
import { reports } from '../../db/schema/reports.js'
import { parseCursor } from '../../lib/cursor-utils.js'
import { communityPosts } from '../../db/schema/community-posts.js'
import { communityReplies } from '../../db/schema/community-replies.js'

export interface ReportResult {
  id: string
  alreadyReported: boolean
}

// ─── Report Post ─────────────────────────────────────────────────────────────

export async function reportPost(
  db: DrizzleDb,
  reporterId: string,
  postId: string,
  reason: ReportReason,
  details?: string,
  logger?: FastifyBaseLogger,
): Promise<ReportResult> {
  // Verify post exists
  const [post] = await db
    .select({ id: communityPosts.id })
    .from(communityPosts)
    .where(eq(communityPosts.id, postId))
    .limit(1)

  if (!post) {
    throw Object.assign(new Error('Post not found'), { statusCode: 404 })
  }

  const inserted = await db
    .insert(reports)
    .values({ reporterId, postId, reason, details })
    .onConflictDoNothing()
    .returning({ id: reports.id })

  if (inserted[0]) {
    logger?.info({ reportId: inserted[0].id, postId, reason }, 'Post reported')
    return { id: inserted[0].id, alreadyReported: false }
  }

  const [existing] = await db
    .select({ id: reports.id })
    .from(reports)
    .where(and(eq(reports.reporterId, reporterId), eq(reports.postId, postId)))
    .limit(1)

  logger?.info({ postId, reporterId }, 'Duplicate post report')
  return { id: existing!.id, alreadyReported: true }
}

// ─── Report Reply ────────────────────────────────────────────────────────────

export async function reportReply(
  db: DrizzleDb,
  reporterId: string,
  replyId: string,
  reason: ReportReason,
  details?: string,
  logger?: FastifyBaseLogger,
): Promise<ReportResult> {
  // Verify reply exists
  const [reply] = await db
    .select({ id: communityReplies.id })
    .from(communityReplies)
    .where(eq(communityReplies.id, replyId))
    .limit(1)

  if (!reply) {
    throw Object.assign(new Error('Reply not found'), { statusCode: 404 })
  }

  const inserted = await db
    .insert(reports)
    .values({ reporterId, replyId, reason, details })
    .onConflictDoNothing()
    .returning({ id: reports.id })

  if (inserted[0]) {
    logger?.info({ reportId: inserted[0].id, replyId, reason }, 'Reply reported')
    return { id: inserted[0].id, alreadyReported: false }
  }

  const [existing] = await db
    .select({ id: reports.id })
    .from(reports)
    .where(and(eq(reports.reporterId, reporterId), eq(reports.replyId, replyId)))
    .limit(1)

  logger?.info({ replyId, reporterId }, 'Duplicate reply report')
  return { id: existing!.id, alreadyReported: true }
}

// ─── Admin: List Reports ──────────────────────────────────────────────────────

export interface ReportListItem {
  id: string
  reason: string
  status: string
  details: string | null
  reporterId: string
  postId: string | null
  replyId: string | null
  createdAt: string
}

export async function listReports(
  db: DrizzleDb,
  filters: { cursor?: string; limit?: number; status?: string },
  logger?: FastifyBaseLogger,
): Promise<{ items: ReportListItem[]; nextCursor: string | null }> {
  const limit = filters.limit ?? 20
  const conditions: ReturnType<typeof eq>[] = []

  if (filters.status) {
    conditions.push(eq(reports.status, filters.status as ReportStatus))
  }

  if (filters.cursor) {
    const parsed = parseCursor(filters.cursor)
    if (parsed) {
      conditions.push(
        or(
          lt(reports.createdAt, parsed.date),
          and(eq(reports.createdAt, parsed.date), lt(reports.id, parsed.id)),
        )!,
      )
    }
  }

  const rows = await db
    .select()
    .from(reports)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(reports.createdAt), desc(reports.id))
    .limit(limit + 1)

  const hasMore = rows.length > limit
  const results = hasMore ? rows.slice(0, limit) : rows

  const items: ReportListItem[] = results.map((r) => ({
    id: r.id,
    reason: r.reason,
    status: r.status,
    details: r.details,
    reporterId: r.reporterId,
    postId: r.postId,
    replyId: r.replyId,
    createdAt: r.createdAt.toISOString(),
  }))

  const lastRow = results[results.length - 1]
  const nextCursor = hasMore && lastRow ? `${lastRow.createdAt.toISOString()}|${lastRow.id}` : null

  logger?.info({ count: items.length, hasMore }, 'Listed reports')
  return { items, nextCursor }
}

// ─── Admin: Update Report Status ────────────────────────────────────────────

export async function updateReportStatus(
  db: DrizzleDb,
  reportId: string,
  status: ReportStatus,
  reviewedBy: string,
  logger?: FastifyBaseLogger,
): Promise<{ id: string; status: string; reviewedBy: string }> {
  const [updated] = await db
    .update(reports)
    .set({ status, reviewedBy })
    .where(eq(reports.id, reportId))
    .returning({ id: reports.id, status: reports.status, reviewedBy: reports.reviewedBy })

  if (!updated) {
    throw Object.assign(new Error('Report not found'), { statusCode: 404 })
  }

  logger?.info({ reportId, status, reviewedBy }, 'Report status updated')
  return {
    id: updated.id,
    status: updated.status,
    reviewedBy: updated.reviewedBy ?? reviewedBy,
  }
}
