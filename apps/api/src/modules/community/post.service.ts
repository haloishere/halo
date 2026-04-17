import { eq, and, desc, or, lt, inArray, isNotNull, gte } from 'drizzle-orm'
import type { FastifyBaseLogger } from 'fastify'
import { parseCursor } from '../../lib/cursor-utils.js'
import type { DrizzleDb } from '../../db/types.js'
import { circles } from '../../db/schema/circles.js'
import { communityPosts } from '../../db/schema/community-posts.js'
import { postLikes } from '../../db/schema/post-likes.js'
import { follows } from '../../db/schema/follows.js'
import { users } from '../../db/schema/users.js'
import { getSignedUrl } from '../../lib/gcs.js'
import { sanitizeContent } from '../../lib/sanitize.js'

export interface PostAuthor {
  id: string
  displayName: string
  caregiverRelationship: string | null
}

export interface PostListItem {
  id: string
  title: string
  bodySnippet: string
  imageUrls: string[]
  author: PostAuthor
  circleName: string
  circleSlug: string
  likeCount: number
  replyCount: number
  isLikedByMe: boolean
  isFeatured: boolean
  createdAt: string
}

export interface PostDetail extends PostListItem {
  body: string
  isFollowingAuthor: boolean
}

function truncate(text: string, max = 200): string {
  if (text.length <= max) return text
  return text.slice(0, max) + '...'
}

async function resolveImageUrls(
  paths: string[],
  bucket?: string,
  logger?: FastifyBaseLogger,
): Promise<string[]> {
  if (!paths.length || !bucket) return []
  const resolved = await Promise.all(paths.map((p) => getSignedUrl(p, bucket, logger)))
  return resolved.filter((u): u is string => u !== null)
}

// ─── List Circles ────────────────────────────────────────────────────────────

export async function listCircles(
  db: DrizzleDb,
  logger?: FastifyBaseLogger,
): Promise<(typeof circles.$inferSelect)[]> {
  const rows = await db.select().from(circles).orderBy(circles.sortOrder)

  logger?.info({ count: rows.length }, 'Listed circles')
  return rows
}

// ─── List Posts (Explore Feed) ───────────────────────────────────────────────

export async function listPosts(
  db: DrizzleDb,
  userId: string,
  filters: { circle?: string; cursor?: string; limit?: number },
  mediaBucket?: string,
  logger?: FastifyBaseLogger,
): Promise<{ items: PostListItem[]; nextCursor: string | null }> {
  const limit = filters.limit ?? 20
  const conditions = [eq(communityPosts.status, 'active')]

  if (filters.circle) {
    const circle = await db
      .select({ id: circles.id })
      .from(circles)
      .where(eq(circles.slug, filters.circle))
      .limit(1)
    if (circle[0]) {
      conditions.push(eq(communityPosts.circleId, circle[0].id))
    }
  }

  if (filters.cursor) {
    const parsed = parseCursor(filters.cursor)
    if (parsed) {
      conditions.push(
        or(
          lt(communityPosts.createdAt, parsed.date),
          and(eq(communityPosts.createdAt, parsed.date), lt(communityPosts.id, parsed.id)),
        )!,
      )
    }
  }

  return fetchPosts(db, userId, conditions, limit, mediaBucket, logger)
}

// ─── Following Feed ──────────────────────────────────────────────────────────

export async function listFollowingPosts(
  db: DrizzleDb,
  userId: string,
  filters: { cursor?: string; limit?: number },
  mediaBucket?: string,
  logger?: FastifyBaseLogger,
): Promise<{ items: PostListItem[]; nextCursor: string | null }> {
  const limit = filters.limit ?? 20

  const followedSubquery = db
    .select({ id: follows.followingId })
    .from(follows)
    .where(eq(follows.followerId, userId))

  const conditions = [
    eq(communityPosts.status, 'active'),
    inArray(communityPosts.authorId, followedSubquery),
  ]

  if (filters.cursor) {
    const parsed = parseCursor(filters.cursor)
    if (parsed) {
      conditions.push(
        or(
          lt(communityPosts.createdAt, parsed.date),
          and(eq(communityPosts.createdAt, parsed.date), lt(communityPosts.id, parsed.id)),
        )!,
      )
    }
  }

  return fetchPosts(db, userId, conditions, limit, mediaBucket, logger)
}

// ─── Spotlight Feed ──────────────────────────────────────────────────────────

export async function listSpotlightPosts(
  db: DrizzleDb,
  userId: string,
  _filters: { cursor?: string; limit?: number },
  mediaBucket?: string,
  logger?: FastifyBaseLogger,
): Promise<{ featured: PostListItem[]; trending: PostListItem[] }> {
  // Featured: admin-pinned posts (max 10)
  const featuredRows = await db
    .select()
    .from(communityPosts)
    .innerJoin(circles, eq(circles.id, communityPosts.circleId))
    .innerJoin(users, eq(users.id, communityPosts.authorId))
    .where(and(eq(communityPosts.status, 'active'), isNotNull(communityPosts.featuredAt)))
    .orderBy(desc(communityPosts.featuredAt))
    .limit(10)

  const featuredLiked = await getLikedPostIds(
    db,
    userId,
    featuredRows.map((r) => r.community_posts.id),
  )

  const featured = await Promise.all(
    featuredRows.map((row) => mapPostRow(row, featuredLiked, mediaBucket, logger)),
  )

  // Trending: top 20 most liked in last 7 days (no pagination — fixed page)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const trendingRows = await db
    .select()
    .from(communityPosts)
    .innerJoin(circles, eq(circles.id, communityPosts.circleId))
    .innerJoin(users, eq(users.id, communityPosts.authorId))
    .where(and(eq(communityPosts.status, 'active'), gte(communityPosts.createdAt, sevenDaysAgo)))
    .orderBy(desc(communityPosts.likeCount), desc(communityPosts.createdAt))
    .limit(20)

  const trendingLiked = await getLikedPostIds(
    db,
    userId,
    trendingRows.map((r) => r.community_posts.id),
  )

  const trending = await Promise.all(
    trendingRows.map((row) => mapPostRow(row, trendingLiked, mediaBucket, logger)),
  )

  logger?.info({ featured: featured.length, trending: trending.length }, 'Listed spotlight posts')
  return { featured, trending }
}

// ─── Get Post Detail ─────────────────────────────────────────────────────────

export async function getPostById(
  db: DrizzleDb,
  postId: string,
  userId: string,
  mediaBucket?: string,
  logger?: FastifyBaseLogger,
): Promise<PostDetail | null> {
  const rows = await db
    .select()
    .from(communityPosts)
    .innerJoin(circles, eq(circles.id, communityPosts.circleId))
    .innerJoin(users, eq(users.id, communityPosts.authorId))
    .where(and(eq(communityPosts.id, postId), eq(communityPosts.status, 'active')))
    .limit(1)

  const row = rows[0]
  if (!row) return null

  const likedSet = await getLikedPostIds(db, userId, [postId])
  const isFollowing = await isFollowingUser(db, userId, row.users.id)

  const imageUrls = await resolveImageUrls(row.community_posts.imageUrls, mediaBucket, logger)

  logger?.info({ postId }, 'Fetched post detail')
  return {
    id: row.community_posts.id,
    title: row.community_posts.title,
    body: row.community_posts.body,
    bodySnippet: truncate(row.community_posts.body),
    imageUrls,
    author: {
      id: row.users.id,
      displayName: row.users.displayName,
      caregiverRelationship: row.users.caregiverRelationship,
    },
    circleName: row.circles.name,
    circleSlug: row.circles.slug,
    likeCount: row.community_posts.likeCount,
    replyCount: row.community_posts.replyCount,
    isLikedByMe: likedSet.has(postId),
    isFeatured: row.community_posts.featuredAt !== null,
    isFollowingAuthor: isFollowing,
    createdAt: row.community_posts.createdAt.toISOString(),
  }
}

// ─── Create Post ─────────────────────────────────────────────────────────────

export async function createPost(
  db: DrizzleDb,
  userId: string,
  data: { circleSlug: string; title: string; body: string; imageUrls: string[] },
  logger?: FastifyBaseLogger,
): Promise<{ id: string; circleId: string }> {
  const circle = await db
    .select({ id: circles.id })
    .from(circles)
    .where(eq(circles.slug, data.circleSlug))
    .limit(1)

  if (!circle[0]) {
    throw Object.assign(new Error('Circle not found'), { statusCode: 404 })
  }

  const [post] = await db
    .insert(communityPosts)
    .values({
      circleId: circle[0].id,
      authorId: userId,
      title: sanitizeContent(data.title),
      body: sanitizeContent(data.body),
      imageUrls: data.imageUrls,
    })
    .returning({ id: communityPosts.id })

  if (!post) {
    throw new Error('Failed to create post')
  }

  logger?.info({ postId: post.id, circleSlug: data.circleSlug }, 'Created community post')
  return { id: post.id, circleId: circle[0].id }
}

// ─── Delete Post ─────────────────────────────────────────────────────────────

export async function deletePost(
  db: DrizzleDb,
  postId: string,
  userId: string,
  userRole: string,
  logger?: FastifyBaseLogger,
): Promise<void> {
  const [post] = await db
    .select({ authorId: communityPosts.authorId })
    .from(communityPosts)
    .where(eq(communityPosts.id, postId))
    .limit(1)

  if (!post) {
    throw Object.assign(new Error('Post not found'), { statusCode: 404 })
  }

  if (post.authorId !== userId && userRole !== 'admin' && userRole !== 'moderator') {
    throw Object.assign(new Error('Not authorized to delete this post'), { statusCode: 403 })
  }

  await db.update(communityPosts).set({ status: 'removed' }).where(eq(communityPosts.id, postId))

  logger?.info({ postId }, 'Soft-deleted community post')
}

// ─── Toggle Featured ─────────────────────────────────────────────────────────

export async function toggleFeatured(
  db: DrizzleDb,
  postId: string,
  logger?: FastifyBaseLogger,
): Promise<{ featured: boolean }> {
  const [post] = await db
    .select({ featuredAt: communityPosts.featuredAt })
    .from(communityPosts)
    .where(and(eq(communityPosts.id, postId), eq(communityPosts.status, 'active')))
    .limit(1)

  if (!post) {
    throw Object.assign(new Error('Post not found'), { statusCode: 404 })
  }

  const nowFeatured = post.featuredAt === null

  await db
    .update(communityPosts)
    .set({ featuredAt: nowFeatured ? new Date() : null })
    .where(eq(communityPosts.id, postId))

  logger?.info({ postId, featured: nowFeatured }, 'Toggled post featured status')
  return { featured: nowFeatured }
}

// ─── Helpers ──────────────────────────────────────────────────────────────��──

async function fetchPosts(
  db: DrizzleDb,
  userId: string,
  conditions: ReturnType<typeof eq>[],
  limit: number,
  mediaBucket?: string,
  logger?: FastifyBaseLogger,
): Promise<{ items: PostListItem[]; nextCursor: string | null }> {
  const rows = await db
    .select()
    .from(communityPosts)
    .innerJoin(circles, eq(circles.id, communityPosts.circleId))
    .innerJoin(users, eq(users.id, communityPosts.authorId))
    .where(and(...conditions))
    .orderBy(desc(communityPosts.createdAt), desc(communityPosts.id))
    .limit(limit + 1)

  const hasMore = rows.length > limit
  const results = hasMore ? rows.slice(0, limit) : rows

  const postIds = results.map((r) => r.community_posts.id)
  const likedSet = await getLikedPostIds(db, userId, postIds)

  const items = await Promise.all(
    results.map((row) => mapPostRow(row, likedSet, mediaBucket, logger)),
  )

  const lastRow = results[results.length - 1]
  const nextCursor =
    hasMore && lastRow
      ? `${lastRow.community_posts.createdAt.toISOString()}|${lastRow.community_posts.id}`
      : null

  logger?.info({ count: items.length, hasMore }, 'Listed community posts')
  return { items, nextCursor }
}

async function getLikedPostIds(
  db: DrizzleDb,
  userId: string,
  postIds: string[],
): Promise<Set<string>> {
  if (postIds.length === 0) return new Set()

  const rows = await db
    .select({ postId: postLikes.postId })
    .from(postLikes)
    .where(and(eq(postLikes.userId, userId), inArray(postLikes.postId, postIds)))

  return new Set(rows.map((r) => r.postId))
}

async function isFollowingUser(
  db: DrizzleDb,
  followerId: string,
  followingId: string,
): Promise<boolean> {
  if (followerId === followingId) return false

  const [row] = await db
    .select({ id: follows.id })
    .from(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)))
    .limit(1)

  return !!row
}

async function mapPostRow(
  row: {
    community_posts: typeof communityPosts.$inferSelect
    circles: typeof circles.$inferSelect
    users: typeof users.$inferSelect
  },
  likedSet: Set<string>,
  mediaBucket?: string,
  logger?: FastifyBaseLogger,
): Promise<PostListItem> {
  const imageUrls = await resolveImageUrls(row.community_posts.imageUrls, mediaBucket, logger)

  return {
    id: row.community_posts.id,
    title: row.community_posts.title,
    bodySnippet: truncate(row.community_posts.body),
    imageUrls,
    author: {
      id: row.users.id,
      displayName: row.users.displayName,
      caregiverRelationship: row.users.caregiverRelationship,
    },
    circleName: row.circles.name,
    circleSlug: row.circles.slug,
    likeCount: row.community_posts.likeCount,
    replyCount: row.community_posts.replyCount,
    isLikedByMe: likedSet.has(row.community_posts.id),
    isFeatured: row.community_posts.featuredAt !== null,
    createdAt: row.community_posts.createdAt.toISOString(),
  }
}
