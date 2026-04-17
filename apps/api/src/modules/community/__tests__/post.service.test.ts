import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../lib/gcs.js', () => ({
  getSignedUrl: vi.fn().mockResolvedValue(null),
}))

vi.mock('../../../lib/sanitize.js', () => ({
  sanitizeContent: vi.fn((s: string) => s),
}))

// Mock drizzle-orm operators so they don't inspect mock DB internals (e.g. inArray with subquery).
vi.mock('drizzle-orm', () => {
  const noop = (..._args: unknown[]) => ({})
  return {
    eq: noop,
    and: noop,
    desc: noop,
    or: noop,
    lt: noop,
    inArray: noop,
    isNotNull: noop,
    gte: noop,
  }
})

import {
  listCircles,
  listPosts,
  listFollowingPosts,
  listSpotlightPosts,
  getPostById,
  createPost,
  deletePost,
  toggleFeatured,
} from '../post.service.js'

// ─── Factories ────────────────────────────────────────────────────────────────

const now = new Date('2026-03-28T12:00:00Z')

function makePostRow(overrides: Record<string, unknown> = {}) {
  return {
    community_posts: {
      id: 'post-1',
      circleId: 'circle-1',
      authorId: 'user-1',
      title: 'Test Title',
      body: 'Test body content for the post',
      imageUrls: [] as string[],
      likeCount: 5,
      replyCount: 2,
      featuredAt: null as Date | null,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      ...overrides,
    },
    circles: {
      id: 'circle-1',
      name: 'Daily Life',
      slug: 'daily-life',
      description: 'Daily life circle',
      sortOrder: 1,
      createdAt: now,
    },
    users: {
      id: 'user-1',
      displayName: 'Jane Doe',
      caregiverRelationship: 'daughter',
      email: 'jane@example.com',
      firebaseUid: 'fb-1',
      role: 'caregiver',
      onboardingComplete: true,
      createdAt: now,
      updatedAt: now,
    },
  }
}

// ─── Mock DB builder ──────────────────────────────────────────────────────────

// Each db.select() call creates an independent chain. The chain resolves to
// whatever is at the END of the chain when awaited. A global queryResults
// array is consumed in order: each time any chain is awaited (at any depth),
// the next entry is popped. This makes test setup simple: just push results
// in the order the service calls them.

function createMockDb() {
  const queryResults: unknown[][] = []

  function popResult(): unknown[] {
    return queryResults.length > 0 ? queryResults.shift()! : []
  }

  // A chain link that is thenable (resolves via popResult) and also has
  // further chain methods for deeper chaining.
  function makeLink(): Record<string, unknown> {
    const link: Record<string, unknown> = {}

    // Chain methods — each returns a new link
    for (const method of ['from', 'where', 'orderBy', 'limit', 'innerJoin']) {
      link[method] = vi.fn().mockImplementation(() => makeLink())
    }

    // Thenable: when awaited, pops from queryResults
    link['then'] = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve(popResult()).then(onFulfilled, onRejected)

    return link
  }

  const selectFn = vi.fn().mockImplementation(() => makeLink())

  const returningFn = vi.fn().mockResolvedValue([])
  const valuesFn = vi.fn().mockReturnValue({ returning: returningFn })
  const insertFn = vi.fn().mockReturnValue({ values: valuesFn })

  const updateWhereFn = vi.fn().mockResolvedValue([])
  const setFn = vi.fn().mockReturnValue({ where: updateWhereFn })
  const updateFn = vi.fn().mockReturnValue({ set: setFn })

  return {
    select: selectFn,
    insert: insertFn,
    update: updateFn,
    _queryResults: queryResults,
    _insert: { returningFn },
  }
}

type MockDb = ReturnType<typeof createMockDb>

// Push expected query results in the order the service will execute them.
function pushResults(db: MockDb, ...rows: unknown[][]) {
  for (const r of rows) db._queryResults.push(r)
}

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
} as never

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('post.service', () => {
  let db: MockDb

  beforeEach(() => {
    vi.clearAllMocks()
    db = createMockDb()
  })

  // ─── listCircles ──────────────────────────────────────────────────────

  describe('listCircles', () => {
    it('returns circles from DB', async () => {
      const circleRows = [
        { id: 'c1', name: 'Daily Life', slug: 'daily-life', sortOrder: 1 },
        { id: 'c2', name: 'Legal & Financial', slug: 'legal', sortOrder: 2 },
      ]
      pushResults(db, circleRows)

      const result = await listCircles(db as never, mockLogger)

      expect(result).toEqual(circleRows)
      expect(mockLogger.info).toHaveBeenCalledWith({ count: 2 }, 'Listed circles')
    })

    it('returns empty array when no circles', async () => {
      pushResults(db, [])

      const result = await listCircles(db as never)

      expect(result).toEqual([])
    })
  })

  // ─── listPosts ────────────────────────────────────────────────────────

  describe('listPosts', () => {
    it('returns posts with default limit', async () => {
      pushResults(
        db,
        [makePostRow()], // fetchPosts query
        [], // getLikedPostIds
      )

      const result = await listPosts(db as never, 'user-1', {}, undefined, mockLogger)

      expect(result.items).toHaveLength(1)
      expect(result.items[0].id).toBe('post-1')
      expect(result.items[0].title).toBe('Test Title')
      expect(result.items[0].isLikedByMe).toBe(false)
      expect(result.nextCursor).toBeNull()
    })

    it('builds next cursor when more results exist', async () => {
      // Return limit+1 rows (default limit=20 so we need 21)
      const rows = Array.from({ length: 21 }, (_, i) =>
        makePostRow({
          id: `post-${i}`,
          createdAt: new Date(`2026-03-${String(28 - i).padStart(2, '0')}T12:00:00Z`),
        }),
      )
      pushResults(db, rows, [])

      const result = await listPosts(db as never, 'user-1', {}, undefined, mockLogger)

      expect(result.items).toHaveLength(20)
      expect(result.nextCursor).not.toBeNull()
      expect(result.nextCursor).toContain('|')
    })

    it('applies circle filter by looking up circle slug', async () => {
      pushResults(
        db,
        [{ id: 'circle-1' }], // circle slug lookup
        [makePostRow()], // fetchPosts
        [], // getLikedPostIds
      )

      const result = await listPosts(db as never, 'user-1', { circle: 'daily-life' })

      expect(result.items).toHaveLength(1)
    })

    it('ignores unrecognized circle slug', async () => {
      pushResults(
        db,
        [], // circle lookup returns empty
        [], // fetchPosts returns nothing
      )

      const result = await listPosts(db as never, 'user-1', { circle: 'nonexistent' })

      expect(result.items).toHaveLength(0)
    })

    it('parses cursor for pagination', async () => {
      const cursor = '2026-03-27T12:00:00.000Z|post-5'
      pushResults(db, [makePostRow()], [])

      const result = await listPosts(db as never, 'user-1', { cursor })

      expect(result.items).toHaveLength(1)
    })

    it('ignores malformed cursor (no pipe separator)', async () => {
      pushResults(db, [])

      const result = await listPosts(db as never, 'user-1', { cursor: 'bad-cursor' })

      expect(result.items).toHaveLength(0)
    })

    it('marks posts liked by user', async () => {
      pushResults(
        db,
        [makePostRow()],
        [{ postId: 'post-1' }], // getLikedPostIds returns the liked post
      )

      const result = await listPosts(db as never, 'user-1', {})

      expect(result.items[0].isLikedByMe).toBe(true)
    })

    it('truncates long body to snippet', async () => {
      const longBody = 'A'.repeat(300)
      pushResults(db, [makePostRow({ body: longBody })], [])

      const result = await listPosts(db as never, 'user-1', {})

      expect(result.items[0].bodySnippet).toHaveLength(203) // 200 + '...'
      expect(result.items[0].bodySnippet).toMatch(/\.{3}$/)
    })

    it('does not truncate short body', async () => {
      pushResults(db, [makePostRow({ body: 'short' })], [])

      const result = await listPosts(db as never, 'user-1', {})

      expect(result.items[0].bodySnippet).toBe('short')
    })

    it('reports isFeatured true when featuredAt is set', async () => {
      pushResults(db, [makePostRow({ featuredAt: now })], [])

      const result = await listPosts(db as never, 'user-1', {})

      expect(result.items[0].isFeatured).toBe(true)
    })
  })

  // ─── listFollowingPosts ───────────────────────────────────────────────

  describe('listFollowingPosts', () => {
    it('returns posts from followed users', async () => {
      pushResults(
        db,
        [makePostRow()], // fetchPosts
        [], // getLikedPostIds
      )

      const result = await listFollowingPosts(db as never, 'user-1', {}, undefined, mockLogger)

      expect(result.items).toHaveLength(1)
    })

    it('returns empty when no followed posts', async () => {
      pushResults(db, [])

      const result = await listFollowingPosts(db as never, 'user-1', {})

      expect(result.items).toHaveLength(0)
      expect(result.nextCursor).toBeNull()
    })

    it('applies cursor pagination', async () => {
      const cursor = '2026-03-27T12:00:00.000Z|post-5'
      pushResults(db, [makePostRow()], [])

      const result = await listFollowingPosts(db as never, 'user-1', { cursor })

      expect(result.items).toHaveLength(1)
    })
  })

  // ─── listSpotlightPosts ───────────────────────────────────────────────

  describe('listSpotlightPosts', () => {
    it('returns featured and trending posts', async () => {
      const featuredRow = makePostRow({ id: 'featured-1', featuredAt: now })
      const trendingRow = makePostRow({ id: 'trending-1', likeCount: 100 })

      pushResults(
        db,
        [featuredRow], // featured query
        [], // featured getLikedPostIds
        [trendingRow], // trending query
        [], // trending getLikedPostIds
      )

      const result = await listSpotlightPosts(db as never, 'user-1', {}, undefined, mockLogger)

      expect(result.featured).toHaveLength(1)
      expect(result.featured[0].id).toBe('featured-1')
      expect(result.trending).toHaveLength(1)
      expect(result.trending[0].id).toBe('trending-1')
    })

    it('returns empty when no posts', async () => {
      pushResults(
        db,
        [], // featured
        [], // trending
      )

      const result = await listSpotlightPosts(db as never, 'user-1', {})

      expect(result.featured).toHaveLength(0)
      expect(result.trending).toHaveLength(0)
    })

    it('returns max 20 trending posts (no pagination)', async () => {
      const rows = Array.from({ length: 20 }, (_, i) =>
        makePostRow({
          id: `t-${i}`,
          createdAt: new Date(`2026-03-${String(28 - i).padStart(2, '0')}T12:00:00Z`),
        }),
      )

      pushResults(
        db,
        [], // featured (none)
        rows, // trending (exactly 20)
        [], // trending getLikedPostIds
      )

      const result = await listSpotlightPosts(db as never, 'user-1', {})

      expect(result.trending).toHaveLength(20)
    })
  })

  // ─── getPostById ──────────────────────────────────────────────────────

  describe('getPostById', () => {
    it('returns post detail with author and follow status', async () => {
      pushResults(
        db,
        [makePostRow()], // post lookup
        [], // getLikedPostIds
        [], // isFollowingUser
      )

      const result = await getPostById(db as never, 'post-1', 'viewer-1', undefined, mockLogger)

      expect(result).not.toBeNull()
      expect(result!.id).toBe('post-1')
      expect(result!.title).toBe('Test Title')
      expect(result!.body).toBe('Test body content for the post')
      expect(result!.bodySnippet).toBe('Test body content for the post')
      expect(result!.author.displayName).toBe('Jane Doe')
      expect(result!.isFollowingAuthor).toBe(false)
      expect(result!.isLikedByMe).toBe(false)
    })

    it('returns null when post not found', async () => {
      pushResults(db, [])

      const result = await getPostById(db as never, 'missing', 'viewer-1')

      expect(result).toBeNull()
    })

    it('marks isLikedByMe true when user liked post', async () => {
      pushResults(
        db,
        [makePostRow()],
        [{ postId: 'post-1' }], // liked
        [], // isFollowing
      )

      const result = await getPostById(db as never, 'post-1', 'viewer-1')

      expect(result!.isLikedByMe).toBe(true)
    })

    it('marks isFollowingAuthor true when viewer follows author', async () => {
      pushResults(
        db,
        [makePostRow()],
        [], // not liked
        [{ id: 'follow-1' }], // isFollowing
      )

      const result = await getPostById(db as never, 'post-1', 'viewer-1')

      expect(result!.isFollowingAuthor).toBe(true)
    })

    it('marks isFeatured true when featuredAt is set', async () => {
      pushResults(db, [makePostRow({ featuredAt: now })], [], [])

      const result = await getPostById(db as never, 'post-1', 'viewer-1')

      expect(result!.isFeatured).toBe(true)
    })

    it('serializes createdAt as ISO string', async () => {
      pushResults(db, [makePostRow()], [], [])

      const result = await getPostById(db as never, 'post-1', 'viewer-1')

      expect(result!.createdAt).toBe('2026-03-28T12:00:00.000Z')
    })
  })

  // ─── createPost ───────────────────────────────────────────────────────

  describe('createPost', () => {
    it('creates post and returns id with circleId', async () => {
      // Circle lookup
      pushResults(db, [{ id: 'circle-1' }])
      // Insert returning
      db._insert.returningFn.mockResolvedValueOnce([{ id: 'new-post-1' }])

      const result = await createPost(
        db as never,
        'user-1',
        { circleSlug: 'daily-life', title: 'My Post', body: 'Post content', imageUrls: [] },
        mockLogger,
      )

      expect(result).toEqual({ id: 'new-post-1', circleId: 'circle-1' })
      expect(db.insert).toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith(
        { postId: 'new-post-1', circleSlug: 'daily-life' },
        'Created community post',
      )
    })

    it('throws 404 when circle not found', async () => {
      pushResults(db, [])

      await expect(
        createPost(db as never, 'user-1', {
          circleSlug: 'nonexistent',
          title: 'T',
          body: 'B',
          imageUrls: [],
        }),
      ).rejects.toMatchObject({ message: 'Circle not found', statusCode: 404 })
    })

    it('throws when insert returns no rows', async () => {
      pushResults(db, [{ id: 'circle-1' }])
      db._insert.returningFn.mockResolvedValueOnce([])

      await expect(
        createPost(db as never, 'user-1', {
          circleSlug: 'daily-life',
          title: 'T',
          body: 'B',
          imageUrls: [],
        }),
      ).rejects.toThrow('Failed to create post')
    })
  })

  // ─── deletePost ───────────────────────────────────────────────────────

  describe('deletePost', () => {
    it('soft-deletes post when author matches', async () => {
      pushResults(db, [{ authorId: 'user-1' }])

      await deletePost(db as never, 'post-1', 'user-1', 'caregiver', mockLogger)

      expect(db.update).toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith(
        { postId: 'post-1' },
        'Soft-deleted community post',
      )
    })

    it('allows admin to delete any post', async () => {
      pushResults(db, [{ authorId: 'other-user' }])

      await expect(
        deletePost(db as never, 'post-1', 'admin-user', 'admin', mockLogger),
      ).resolves.toBeUndefined()
    })

    it('allows moderator to delete any post', async () => {
      pushResults(db, [{ authorId: 'other-user' }])

      await expect(
        deletePost(db as never, 'post-1', 'mod-user', 'moderator', mockLogger),
      ).resolves.toBeUndefined()
    })

    it('throws 404 when post not found', async () => {
      pushResults(db, [])

      await expect(deletePost(db as never, 'missing', 'user-1', 'caregiver')).rejects.toMatchObject(
        { message: 'Post not found', statusCode: 404 },
      )
    })

    it('throws 403 when non-author non-admin tries to delete', async () => {
      pushResults(db, [{ authorId: 'other-user' }])

      await expect(deletePost(db as never, 'post-1', 'user-1', 'caregiver')).rejects.toMatchObject({
        message: 'Not authorized to delete this post',
        statusCode: 403,
      })
    })
  })

  // ─── toggleFeatured ───────────────────────────────────────────────────

  describe('toggleFeatured', () => {
    it('features a non-featured post', async () => {
      pushResults(db, [{ featuredAt: null }])

      const result = await toggleFeatured(db as never, 'post-1', mockLogger)

      expect(result).toEqual({ featured: true })
      expect(db.update).toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith(
        { postId: 'post-1', featured: true },
        'Toggled post featured status',
      )
    })

    it('unfeatures a featured post', async () => {
      pushResults(db, [{ featuredAt: now }])

      const result = await toggleFeatured(db as never, 'post-1', mockLogger)

      expect(result).toEqual({ featured: false })
    })

    it('throws 404 when post not found', async () => {
      pushResults(db, [])

      await expect(toggleFeatured(db as never, 'missing')).rejects.toMatchObject({
        message: 'Post not found',
        statusCode: 404,
      })
    })
  })
})
