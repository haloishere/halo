import { eq, and, sql } from 'drizzle-orm'
import type { FastifyBaseLogger } from 'fastify'
import type { DrizzleDb } from '../../db/types.js'
import { postLikes } from '../../db/schema/post-likes.js'
import { replyLikes } from '../../db/schema/reply-likes.js'
import { communityPosts } from '../../db/schema/community-posts.js'
import { communityReplies } from '../../db/schema/community-replies.js'

export interface LikeToggleResult {
  liked: boolean
  likeCount: number
}

// ─── Toggle Post Like ────────────────────────────────────────────────────────

export async function togglePostLike(
  db: DrizzleDb,
  userId: string,
  postId: string,
  logger?: FastifyBaseLogger,
): Promise<LikeToggleResult> {
  return db.transaction(async (tx) => {
    const [post] = await tx
      .select({ id: communityPosts.id, likeCount: communityPosts.likeCount })
      .from(communityPosts)
      .where(and(eq(communityPosts.id, postId), eq(communityPosts.status, 'active')))
      .limit(1)

    if (!post) {
      throw Object.assign(new Error('Post not found'), { statusCode: 404 })
    }

    const inserted = await tx
      .insert(postLikes)
      .values({ userId, postId })
      .onConflictDoNothing()
      .returning()

    if (inserted.length > 0) {
      const [updated] = await tx
        .update(communityPosts)
        .set({ likeCount: sql`${communityPosts.likeCount} + 1` })
        .where(eq(communityPosts.id, postId))
        .returning({ likeCount: communityPosts.likeCount })

      logger?.info({ postId }, 'Post liked')
      return { liked: true, likeCount: updated?.likeCount ?? post.likeCount + 1 }
    }

    await tx
      .delete(postLikes)
      .where(and(eq(postLikes.userId, userId), eq(postLikes.postId, postId)))

    const [updated] = await tx
      .update(communityPosts)
      .set({ likeCount: sql`GREATEST(${communityPosts.likeCount} - 1, 0)` })
      .where(eq(communityPosts.id, postId))
      .returning({ likeCount: communityPosts.likeCount })

    logger?.info({ postId }, 'Post unliked')
    return { liked: false, likeCount: updated?.likeCount ?? Math.max(post.likeCount - 1, 0) }
  })
}

// ─── Toggle Reply Like ───────────────────────────────────────────────────────

export async function toggleReplyLike(
  db: DrizzleDb,
  userId: string,
  replyId: string,
  logger?: FastifyBaseLogger,
): Promise<LikeToggleResult> {
  return db.transaction(async (tx) => {
    const [reply] = await tx
      .select({ id: communityReplies.id, likeCount: communityReplies.likeCount })
      .from(communityReplies)
      .where(and(eq(communityReplies.id, replyId), eq(communityReplies.status, 'active')))
      .limit(1)

    if (!reply) {
      throw Object.assign(new Error('Reply not found'), { statusCode: 404 })
    }

    const inserted = await tx
      .insert(replyLikes)
      .values({ userId, replyId })
      .onConflictDoNothing()
      .returning()

    if (inserted.length > 0) {
      const [updated] = await tx
        .update(communityReplies)
        .set({ likeCount: sql`${communityReplies.likeCount} + 1` })
        .where(eq(communityReplies.id, replyId))
        .returning({ likeCount: communityReplies.likeCount })

      logger?.info({ replyId }, 'Reply liked')
      return { liked: true, likeCount: updated?.likeCount ?? reply.likeCount + 1 }
    }

    await tx
      .delete(replyLikes)
      .where(and(eq(replyLikes.userId, userId), eq(replyLikes.replyId, replyId)))

    const [updated] = await tx
      .update(communityReplies)
      .set({ likeCount: sql`GREATEST(${communityReplies.likeCount} - 1, 0)` })
      .where(eq(communityReplies.id, replyId))
      .returning({ likeCount: communityReplies.likeCount })

    logger?.info({ replyId }, 'Reply unliked')
    return { liked: false, likeCount: updated?.likeCount ?? Math.max(reply.likeCount - 1, 0) }
  })
}
