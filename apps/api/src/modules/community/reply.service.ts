import { eq, and, desc, or, lt, inArray, sql } from 'drizzle-orm'
import { sanitizeContent } from '../../lib/sanitize.js'
import type { FastifyBaseLogger } from 'fastify'
import type { DrizzleDb } from '../../db/types.js'
import { communityReplies } from '../../db/schema/community-replies.js'
import { communityPosts } from '../../db/schema/community-posts.js'
import { replyLikes } from '../../db/schema/reply-likes.js'
import { users } from '../../db/schema/users.js'

export interface ReplyItem {
  id: string
  body: string
  author: {
    id: string
    displayName: string
    caregiverRelationship: string | null
  }
  likeCount: number
  isLikedByMe: boolean
  createdAt: string
}

// ─── List Replies ────────────────────────────────────────────────────────────

export async function listReplies(
  db: DrizzleDb,
  postId: string,
  userId: string,
  filters: { cursor?: string; limit?: number },
  logger?: FastifyBaseLogger,
): Promise<{ items: ReplyItem[]; nextCursor: string | null }> {
  const limit = filters.limit ?? 20
  const conditions = [eq(communityReplies.postId, postId), eq(communityReplies.status, 'active')]

  if (filters.cursor) {
    const [cursorDate, cursorId] = filters.cursor.split('|')
    if (cursorDate && cursorId) {
      const d = new Date(cursorDate)
      conditions.push(
        or(
          lt(communityReplies.createdAt, d),
          and(eq(communityReplies.createdAt, d), lt(communityReplies.id, cursorId)),
        )!,
      )
    }
  }

  const rows = await db
    .select()
    .from(communityReplies)
    .innerJoin(users, eq(users.id, communityReplies.authorId))
    .where(and(...conditions))
    .orderBy(desc(communityReplies.createdAt), desc(communityReplies.id))
    .limit(limit + 1)

  const hasMore = rows.length > limit
  const results = hasMore ? rows.slice(0, limit) : rows

  const replyIds = results.map((r) => r.community_replies.id)
  const likedSet = await getLikedReplyIds(db, userId, replyIds)

  const items: ReplyItem[] = results.map((row) => ({
    id: row.community_replies.id,
    body: row.community_replies.body,
    author: {
      id: row.users.id,
      displayName: row.users.displayName,
      caregiverRelationship: row.users.caregiverRelationship,
    },
    likeCount: row.community_replies.likeCount,
    isLikedByMe: likedSet.has(row.community_replies.id),
    createdAt: row.community_replies.createdAt.toISOString(),
  }))

  const lastRow = results[results.length - 1]
  const nextCursor =
    hasMore && lastRow
      ? `${lastRow.community_replies.createdAt.toISOString()}|${lastRow.community_replies.id}`
      : null

  logger?.info({ postId, count: items.length, hasMore }, 'Listed replies')
  return { items, nextCursor }
}

// ─── Create Reply ────────────────────────────────────────────────────────────

export async function createReply(
  db: DrizzleDb,
  postId: string,
  userId: string,
  body: string,
  logger?: FastifyBaseLogger,
): Promise<{ id: string }> {
  // Verify post exists and is active
  const [post] = await db
    .select({ id: communityPosts.id })
    .from(communityPosts)
    .where(and(eq(communityPosts.id, postId), eq(communityPosts.status, 'active')))
    .limit(1)

  if (!post) {
    throw Object.assign(new Error('Post not found'), { statusCode: 404 })
  }

  const reply = await db.transaction(async (tx) => {
    const [r] = await tx
      .insert(communityReplies)
      .values({ postId, authorId: userId, body: sanitizeContent(body) })
      .returning({ id: communityReplies.id })

    if (!r) throw new Error('Failed to create reply')

    await tx
      .update(communityPosts)
      .set({ replyCount: sql`${communityPosts.replyCount} + 1` })
      .where(eq(communityPosts.id, postId))

    return r
  })

  logger?.info({ replyId: reply.id, postId }, 'Created reply')
  return { id: reply.id }
}

// ─── Delete Reply ────────────────────────────────────────────────────────────

export async function deleteReply(
  db: DrizzleDb,
  replyId: string,
  userId: string,
  userRole: string,
  logger?: FastifyBaseLogger,
): Promise<void> {
  const [reply] = await db
    .select({ authorId: communityReplies.authorId, postId: communityReplies.postId })
    .from(communityReplies)
    .where(and(eq(communityReplies.id, replyId), eq(communityReplies.status, 'active')))
    .limit(1)

  if (!reply) {
    throw Object.assign(new Error('Reply not found'), { statusCode: 404 })
  }

  if (reply.authorId !== userId && userRole !== 'admin' && userRole !== 'moderator') {
    throw Object.assign(new Error('Not authorized to delete this reply'), { statusCode: 403 })
  }

  await db.transaction(async (tx) => {
    await tx
      .update(communityReplies)
      .set({ status: 'removed' })
      .where(eq(communityReplies.id, replyId))

    await tx
      .update(communityPosts)
      .set({ replyCount: sql`GREATEST(${communityPosts.replyCount} - 1, 0)` })
      .where(eq(communityPosts.id, reply.postId))
  })

  logger?.info({ replyId }, 'Soft-deleted reply')
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getLikedReplyIds(
  db: DrizzleDb,
  userId: string,
  replyIds: string[],
): Promise<Set<string>> {
  if (replyIds.length === 0) return new Set()

  const rows = await db
    .select({ replyId: replyLikes.replyId })
    .from(replyLikes)
    .where(and(eq(replyLikes.userId, userId), inArray(replyLikes.replyId, replyIds)))

  return new Set(rows.map((r) => r.replyId))
}
