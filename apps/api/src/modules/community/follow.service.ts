import { eq, and, desc, or, lt, inArray } from 'drizzle-orm'
import type { FastifyBaseLogger } from 'fastify'
import type { DrizzleDb } from '../../db/types.js'
import { follows } from '../../db/schema/follows.js'
import { users } from '../../db/schema/users.js'
import { parseCursor } from '../../lib/cursor-utils.js'

export interface FollowToggleResult {
  following: boolean
}

export interface FollowUser {
  id: string
  displayName: string
  caregiverRelationship: string | null
  isFollowedByMe: boolean
}

// ─── Toggle Follow ───────────────────────────────────────────────────────────

export async function toggleFollow(
  db: DrizzleDb,
  followerId: string,
  followingId: string,
  logger?: FastifyBaseLogger,
): Promise<FollowToggleResult> {
  if (followerId === followingId) {
    throw Object.assign(new Error('Cannot follow yourself'), { statusCode: 400 })
  }

  // Verify target user exists
  const [target] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, followingId))
    .limit(1)

  if (!target) {
    throw Object.assign(new Error('User not found'), { statusCode: 404 })
  }

  // Try insert — ON CONFLICT DO NOTHING avoids TOCTOU race
  const inserted = await db
    .insert(follows)
    .values({ followerId, followingId })
    .onConflictDoNothing()
    .returning()

  if (inserted.length > 0) {
    logger?.info({ followerId, followingId }, 'Followed user')
    return { following: true }
  }

  // Already existed — unfollow
  await db
    .delete(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)))

  logger?.info({ followerId, followingId }, 'Unfollowed user')
  return { following: false }
}

// ─── List Followers ──────────────────────────────────────────────────────────

export async function listFollowers(
  db: DrizzleDb,
  userId: string,
  currentUserId: string,
  filters: { cursor?: string; limit?: number },
  logger?: FastifyBaseLogger,
): Promise<{ items: FollowUser[]; nextCursor: string | null }> {
  const limit = filters.limit ?? 20
  const conditions = [eq(follows.followingId, userId)]

  if (filters.cursor) {
    const parsed = parseCursor(filters.cursor)
    if (parsed) {
      conditions.push(
        or(
          lt(follows.createdAt, parsed.date),
          and(eq(follows.createdAt, parsed.date), lt(follows.id, parsed.id)),
        )!,
      )
    }
  }

  const rows = await db
    .select()
    .from(follows)
    .innerJoin(users, eq(users.id, follows.followerId))
    .where(and(...conditions))
    .orderBy(desc(follows.createdAt), desc(follows.id))
    .limit(limit + 1)

  const hasMore = rows.length > limit
  const results = hasMore ? rows.slice(0, limit) : rows

  const followerIds = results.map((r) => r.users.id)
  const myFollowingSet = await getFollowingSet(db, currentUserId, followerIds)

  const items: FollowUser[] = results.map((row) => ({
    id: row.users.id,
    displayName: row.users.displayName,
    caregiverRelationship: row.users.caregiverRelationship,
    isFollowedByMe: myFollowingSet.has(row.users.id),
  }))

  const lastRow = results[results.length - 1]
  const nextCursor =
    hasMore && lastRow ? `${lastRow.follows.createdAt.toISOString()}|${lastRow.follows.id}` : null

  logger?.info({ userId, count: items.length }, 'Listed followers')
  return { items, nextCursor }
}

// ─── List Following ──────────────────────────────────────────────────────────

export async function listFollowing(
  db: DrizzleDb,
  userId: string,
  currentUserId: string,
  filters: { cursor?: string; limit?: number },
  logger?: FastifyBaseLogger,
): Promise<{ items: FollowUser[]; nextCursor: string | null }> {
  const limit = filters.limit ?? 20
  const conditions = [eq(follows.followerId, userId)]

  if (filters.cursor) {
    const parsed = parseCursor(filters.cursor)
    if (parsed) {
      conditions.push(
        or(
          lt(follows.createdAt, parsed.date),
          and(eq(follows.createdAt, parsed.date), lt(follows.id, parsed.id)),
        )!,
      )
    }
  }

  const rows = await db
    .select()
    .from(follows)
    .innerJoin(users, eq(users.id, follows.followingId))
    .where(and(...conditions))
    .orderBy(desc(follows.createdAt), desc(follows.id))
    .limit(limit + 1)

  const hasMore = rows.length > limit
  const results = hasMore ? rows.slice(0, limit) : rows

  const followingIds = results.map((r) => r.users.id)
  const myFollowingSet = await getFollowingSet(db, currentUserId, followingIds)

  const items: FollowUser[] = results.map((row) => ({
    id: row.users.id,
    displayName: row.users.displayName,
    caregiverRelationship: row.users.caregiverRelationship,
    isFollowedByMe: myFollowingSet.has(row.users.id),
  }))

  const lastRow = results[results.length - 1]
  const nextCursor =
    hasMore && lastRow ? `${lastRow.follows.createdAt.toISOString()}|${lastRow.follows.id}` : null

  logger?.info({ userId, count: items.length }, 'Listed following')
  return { items, nextCursor }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getFollowingSet(
  db: DrizzleDb,
  userId: string,
  targetIds: string[],
): Promise<Set<string>> {
  if (targetIds.length === 0) return new Set()

  const rows = await db
    .select({ followingId: follows.followingId })
    .from(follows)
    .where(and(eq(follows.followerId, userId), inArray(follows.followingId, targetIds)))

  return new Set(rows.map((r) => r.followingId))
}
