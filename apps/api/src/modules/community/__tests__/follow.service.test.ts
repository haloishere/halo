import { describe, it, expect, vi, beforeEach } from 'vitest'
import { toggleFollow, listFollowers, listFollowing } from '../follow.service.js'

// ─── Mock DB Helpers ────────────────────────────────────────────────────────

function buildSimpleSelectChain(rows: unknown[] = []) {
  return vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  })
}

function buildInsertChain(rows: unknown[] = []) {
  return vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({
      onConflictDoNothing: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue(rows),
      }),
    }),
  })
}

function buildDeleteChain() {
  return vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  })
}

// buildJoinSelectChain and buildFollowingSetSelect removed — unused

const now = new Date('2026-03-28T12:00:00.000Z')

function makeFollowerRow(userId: string, followId: string) {
  return {
    follows: {
      id: followId,
      followerId: userId,
      followingId: 'target-user',
      createdAt: now,
    },
    users: {
      id: userId,
      displayName: `User ${userId}`,
      caregiverRelationship: 'child',
    },
  }
}

function makeFollowingRow(userId: string, followId: string) {
  return {
    follows: {
      id: followId,
      followerId: 'current-user',
      followingId: userId,
      createdAt: now,
    },
    users: {
      id: userId,
      displayName: `User ${userId}`,
      caregiverRelationship: null,
    },
  }
}

// ─── toggleFollow ───────────────────────────────────────────────────────────

describe('toggleFollow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('follows a user successfully', async () => {
    const db = {
      select: buildSimpleSelectChain([{ id: 'target' }]),
      insert: buildInsertChain([{ followerId: 'me', followingId: 'target' }]),
      delete: buildDeleteChain(),
    } as never

    const result = await toggleFollow(db, 'me', 'target')

    expect(result).toEqual({ following: true })
  })

  it('unfollows when already following', async () => {
    const db = {
      select: buildSimpleSelectChain([{ id: 'target' }]),
      insert: buildInsertChain([]), // conflict, empty
      delete: buildDeleteChain(),
    } as never

    const result = await toggleFollow(db, 'me', 'target')

    expect(result).toEqual({ following: false })
  })

  it('throws 400 when trying to follow self', async () => {
    const db = {} as never

    await expect(toggleFollow(db, 'same-user', 'same-user')).rejects.toMatchObject({
      message: 'Cannot follow yourself',
      statusCode: 400,
    })
  })

  it('throws 404 when target user not found', async () => {
    const db = {
      select: buildSimpleSelectChain([]),
      insert: buildInsertChain(),
    } as never

    await expect(toggleFollow(db, 'me', 'nonexistent')).rejects.toMatchObject({
      message: 'User not found',
      statusCode: 404,
    })
  })

  it('logs when following a user', async () => {
    const db = {
      select: buildSimpleSelectChain([{ id: 'target' }]),
      insert: buildInsertChain([{ followerId: 'me', followingId: 'target' }]),
    } as never
    const logger = { info: vi.fn() } as never

    await toggleFollow(db, 'me', 'target', logger)

    expect((logger as { info: ReturnType<typeof vi.fn> }).info).toHaveBeenCalledWith(
      { followerId: 'me', followingId: 'target' },
      'Followed user',
    )
  })

  it('logs when unfollowing a user', async () => {
    const db = {
      select: buildSimpleSelectChain([{ id: 'target' }]),
      insert: buildInsertChain([]),
      delete: buildDeleteChain(),
    } as never
    const logger = { info: vi.fn() } as never

    await toggleFollow(db, 'me', 'target', logger)

    expect((logger as { info: ReturnType<typeof vi.fn> }).info).toHaveBeenCalledWith(
      { followerId: 'me', followingId: 'target' },
      'Unfollowed user',
    )
  })
})

// ─── listFollowers ──────────────────────────────────────────────────────────

describe('listFollowers', () => {
  const userId = 'target-user'
  const currentUserId = 'current-user'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty list when no followers', async () => {
    let callCount = 0
    const db = {
      select: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          // join query
          return {
            from: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([]),
                  }),
                }),
              }),
            }),
          }
        }
        // getFollowingSet (won't be called for empty arrays but just in case)
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }
      }),
    } as never

    const result = await listFollowers(db, userId, currentUserId, {})

    expect(result).toEqual({ items: [], nextCursor: null })
  })

  it('returns followers with isFollowedByMe', async () => {
    const rows = [makeFollowerRow('follower-1', 'f1'), makeFollowerRow('follower-2', 'f2')]

    let callCount = 0
    const db = {
      select: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return {
            from: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue(rows),
                  }),
                }),
              }),
            }),
          }
        }
        // getFollowingSet: current user follows follower-1
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ followingId: 'follower-1' }]),
          }),
        }
      }),
    } as never

    const result = await listFollowers(db, userId, currentUserId, { limit: 20 })

    expect(result.items).toHaveLength(2)
    expect(result.items[0]!.id).toBe('follower-1')
    expect(result.items[0]!.isFollowedByMe).toBe(true)
    expect(result.items[1]!.id).toBe('follower-2')
    expect(result.items[1]!.isFollowedByMe).toBe(false)
    expect(result.nextCursor).toBeNull()
  })

  it('returns nextCursor when hasMore', async () => {
    const rows = [
      makeFollowerRow('f-a', 'fa'),
      makeFollowerRow('f-b', 'fb'),
      makeFollowerRow('f-c', 'fc'), // extra row triggers hasMore
    ]

    let callCount = 0
    const db = {
      select: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return {
            from: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue(rows),
                  }),
                }),
              }),
            }),
          }
        }
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }
      }),
    } as never

    const result = await listFollowers(db, userId, currentUserId, { limit: 2 })

    expect(result.items).toHaveLength(2)
    expect(result.nextCursor).toContain('|fb')
  })

  it('handles cursor-based pagination', async () => {
    let callCount = 0
    const db = {
      select: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return {
            from: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([]),
                  }),
                }),
              }),
            }),
          }
        }
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }
      }),
    } as never

    const result = await listFollowers(db, userId, currentUserId, {
      cursor: '2026-03-28T10:00:00.000Z|some-uuid',
    })

    expect(result.items).toEqual([])
    expect(result.nextCursor).toBeNull()
  })
})

// ─── listFollowing ──────────────────────────────────────────────────────────

describe('listFollowing', () => {
  const userId = 'current-user'
  const currentUserId = 'current-user'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty list when not following anyone', async () => {
    let callCount = 0
    const db = {
      select: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return {
            from: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([]),
                  }),
                }),
              }),
            }),
          }
        }
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }
      }),
    } as never

    const result = await listFollowing(db, userId, currentUserId, {})

    expect(result).toEqual({ items: [], nextCursor: null })
  })

  it('returns following list with correct mapping', async () => {
    const rows = [makeFollowingRow('target-a', 'f1')]

    let callCount = 0
    const db = {
      select: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return {
            from: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue(rows),
                  }),
                }),
              }),
            }),
          }
        }
        // getFollowingSet
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ followingId: 'target-a' }]),
          }),
        }
      }),
    } as never

    const result = await listFollowing(db, userId, currentUserId, {})

    expect(result.items).toHaveLength(1)
    expect(result.items[0]!.id).toBe('target-a')
    expect(result.items[0]!.isFollowedByMe).toBe(true)
    expect(result.items[0]!.caregiverRelationship).toBeNull()
  })

  it('paginates with nextCursor', async () => {
    const rows = [
      makeFollowingRow('t-1', 'f1'),
      makeFollowingRow('t-2', 'f2'),
      makeFollowingRow('t-3', 'f3'), // extra
    ]

    let callCount = 0
    const db = {
      select: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return {
            from: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue(rows),
                  }),
                }),
              }),
            }),
          }
        }
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }
      }),
    } as never

    const result = await listFollowing(db, userId, currentUserId, { limit: 2 })

    expect(result.items).toHaveLength(2)
    expect(result.nextCursor).toContain('|f2')
  })
})
