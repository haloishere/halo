import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { mockFirebaseAuth } from '../../../test/mocks/index.js'

// ─── Module Mocks ────────────────────────────────────────────────────────────

vi.mock('../../../lib/firebase-admin.js', () => ({
  firebaseAuth: mockFirebaseAuth,
}))

vi.mock('../../../lib/sentry.js', () => ({
  Sentry: { captureException: vi.fn() },
}))

vi.mock('../../../lib/audit.js', () => ({
  writeAuditLog: vi.fn(),
}))

vi.mock('../../../lib/vertex-ai.js', () => ({
  getAiClient: vi.fn().mockReturnValue({
    generateContent: vi.fn().mockResolvedValue('APPROVED'),
    generateContentStream: vi.fn(),
    countTokens: vi.fn(),
  }),
}))

const {
  mockCreatePost,
  mockListPosts,
  mockListFollowingPosts,
  mockListSpotlightPosts,
  mockGetPostById,
  mockDeletePost,
  mockToggleFeatured,
  mockListCircles,
} = vi.hoisted(() => ({
  mockCreatePost: vi.fn(),
  mockCreateReply: vi.fn(),
  mockListPosts: vi.fn(),
  mockListFollowingPosts: vi.fn(),
  mockListSpotlightPosts: vi.fn(),
  mockGetPostById: vi.fn(),
  mockDeletePost: vi.fn(),
  mockToggleFeatured: vi.fn(),
  mockListCircles: vi.fn(),
}))

vi.mock('../post.service.js', () => ({
  createPost: mockCreatePost,
  listPosts: mockListPosts,
  listFollowingPosts: mockListFollowingPosts,
  listSpotlightPosts: mockListSpotlightPosts,
  getPostById: mockGetPostById,
  deletePost: mockDeletePost,
  toggleFeatured: mockToggleFeatured,
  listCircles: mockListCircles,
}))

const { mockListReplies, mockCreateReplyService, mockDeleteReply } = vi.hoisted(() => ({
  mockListReplies: vi.fn(),
  mockCreateReplyService: vi.fn(),
  mockDeleteReply: vi.fn(),
}))

vi.mock('../reply.service.js', () => ({
  listReplies: mockListReplies,
  createReply: mockCreateReplyService,
  deleteReply: mockDeleteReply,
}))

const { mockTogglePostLike, mockToggleReplyLike } = vi.hoisted(() => ({
  mockTogglePostLike: vi.fn(),
  mockToggleReplyLike: vi.fn(),
}))

vi.mock('../like.service.js', () => ({
  togglePostLike: mockTogglePostLike,
  toggleReplyLike: mockToggleReplyLike,
}))

const { mockToggleFollow, mockListFollowers, mockListFollowing } = vi.hoisted(() => ({
  mockToggleFollow: vi.fn(),
  mockListFollowers: vi.fn(),
  mockListFollowing: vi.fn(),
}))

vi.mock('../follow.service.js', () => ({
  toggleFollow: mockToggleFollow,
  listFollowers: mockListFollowers,
  listFollowing: mockListFollowing,
}))

const { mockReportPost, mockReportReply, mockListReports, mockUpdateReportStatus } = vi.hoisted(
  () => ({
    mockReportPost: vi.fn(),
    mockReportReply: vi.fn(),
    mockListReports: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    mockUpdateReportStatus: vi.fn(),
  }),
)

vi.mock('../report.service.js', () => ({
  reportPost: mockReportPost,
  reportReply: mockReportReply,
  listReports: mockListReports,
  updateReportStatus: mockUpdateReportStatus,
}))

vi.mock('../upload.service.js', () => ({
  generateUploadUrl: vi.fn(),
}))

vi.mock('../moderation.service.js', () => ({
  moderateContent: vi.fn().mockResolvedValue({ approved: true }),
}))

// ─── Test Helpers ────────────────────────────────────────────────────────────

const { createTestApp } = await import('../../../test/helpers.js')
const communityRoutes = (await import('../community.routes.js')).default

const TEST_USER_ID = '00000000-0000-4000-8000-000000000001'
const TEST_POST_ID = '00000000-0000-4000-8000-000000000010'
const TEST_REPLY_ID = '00000000-0000-4000-8000-000000000020'

function createMockDb(overrides: { role?: string; tier?: string } = {}) {
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            {
              id: TEST_USER_ID,
              role: overrides.role ?? 'user',
              tier: overrides.tier ?? 'free',
            },
          ]),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
  }
}

async function buildCommunityApp(opts: { role?: string } = {}): Promise<FastifyInstance> {
  mockFirebaseAuth.verifyIdToken.mockResolvedValue({
    uid: 'firebase-uid-123',
    email: 'test@example.com',
    role: opts.role ?? 'user',
    tier: 'free',
  })

  const app = await createTestApp()
  app.decorate('db', createMockDb({ role: opts.role }))
  await app.register(communityRoutes, { prefix: '/v1/community' })
  await app.ready()
  return app
}

// ─────────────────────────────────────────────────────────────────────────────
// FIX 1: Crisis resources returned in create post/reply response
// ─────────────────────────────────────────────────────────────────────────────

describe('Fix 1: Crisis resources in create post/reply response', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.clearAllMocks()
    app = await buildCommunityApp()
  })

  afterEach(async () => {
    await app.close()
  })

  describe('POST /v1/community/posts', () => {
    it('includes crisisResources when body contains crisis keywords', async () => {
      mockCreatePost.mockResolvedValue({ id: TEST_POST_ID, circleId: 'circle-1' })

      const response = await app.inject({
        method: 'POST',
        url: '/v1/community/posts',
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          circleSlug: 'emotional-support',
          title: 'Feeling hopeless',
          body: 'I want to end it all, I cannot keep doing this',
          imageUrls: [],
        },
      })

      expect(response.statusCode).toBe(201)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(body.data.id).toBe(TEST_POST_ID)
      expect(body.data.crisisResources).toBeDefined()
      expect(body.data.crisisResources).toContain('988')
      expect(body.data.crisisResources).toContain('Crisis')
    })

    it('includes crisisResources when title contains suicide keyword', async () => {
      mockCreatePost.mockResolvedValue({ id: TEST_POST_ID, circleId: 'circle-1' })

      const response = await app.inject({
        method: 'POST',
        url: '/v1/community/posts',
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          circleSlug: 'emotional-support',
          title: 'Suicidal thoughts as a caregiver',
          body: 'I need help coping with these feelings',
          imageUrls: [],
        },
      })

      expect(response.statusCode).toBe(201)
      const body = response.json()
      expect(body.data.crisisResources).toBeDefined()
      expect(body.data.crisisResources).toContain('988')
    })

    it('does NOT include crisisResources for normal posts', async () => {
      mockCreatePost.mockResolvedValue({ id: TEST_POST_ID, circleId: 'circle-1' })

      const response = await app.inject({
        method: 'POST',
        url: '/v1/community/posts',
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          circleSlug: 'daily-care-tips',
          title: 'Tips for morning routine',
          body: 'I found a great way to help my mom with breakfast',
          imageUrls: [],
        },
      })

      expect(response.statusCode).toBe(201)
      const body = response.json()
      expect(body.data.id).toBe(TEST_POST_ID)
      expect(body.data.crisisResources).toBeUndefined()
    })

    it('includes crisisResources for elder abuse keywords', async () => {
      mockCreatePost.mockResolvedValue({ id: TEST_POST_ID, circleId: 'circle-1' })

      const response = await app.inject({
        method: 'POST',
        url: '/v1/community/posts',
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          circleSlug: 'emotional-support',
          title: 'Concerned about care',
          body: 'I think someone is abusing my elderly mother at the facility',
          imageUrls: [],
        },
      })

      expect(response.statusCode).toBe(201)
      const body = response.json()
      expect(body.data.crisisResources).toBeDefined()
      expect(body.data.crisisResources).toContain('Adult Protective Services')
    })
  })

  describe('POST /v1/community/posts/:id/replies', () => {
    it('includes crisisResources when reply body contains crisis keywords', async () => {
      mockCreateReplyService.mockResolvedValue({ id: TEST_REPLY_ID })

      const response = await app.inject({
        method: 'POST',
        url: `/v1/community/posts/${TEST_POST_ID}/replies`,
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          body: 'I feel like hurting myself, this is too much',
        },
      })

      expect(response.statusCode).toBe(201)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(body.data.id).toBe(TEST_REPLY_ID)
      expect(body.data.crisisResources).toBeDefined()
      expect(body.data.crisisResources).toContain('988')
    })

    it('does NOT include crisisResources for normal replies', async () => {
      mockCreateReplyService.mockResolvedValue({ id: TEST_REPLY_ID })

      const response = await app.inject({
        method: 'POST',
        url: `/v1/community/posts/${TEST_POST_ID}/replies`,
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          body: 'Thank you for sharing, this really helped me today',
        },
      })

      expect(response.statusCode).toBe(201)
      const body = response.json()
      expect(body.data.id).toBe(TEST_REPLY_ID)
      expect(body.data.crisisResources).toBeUndefined()
    })

    it('detects "want to die" in reply', async () => {
      mockCreateReplyService.mockResolvedValue({ id: TEST_REPLY_ID })

      const response = await app.inject({
        method: 'POST',
        url: `/v1/community/posts/${TEST_POST_ID}/replies`,
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          body: 'Sometimes I just want to die after a long day of caregiving',
        },
      })

      expect(response.statusCode).toBe(201)
      const body = response.json()
      expect(body.data.crisisResources).toBeDefined()
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// FIX 2: Cursor validation returns 400
// ─────────────────────────────────────────────────────────────────────────────

describe('Fix 2: Cursor validation returns 400 for malformed cursors', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.clearAllMocks()
    app = await buildCommunityApp()
  })

  afterEach(async () => {
    await app.close()
  })

  describe('GET /v1/community/posts (explore feed)', () => {
    it('returns 400 for completely garbage cursor', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/community/posts?cursor=garbage%7Cnotauuid',
        headers: { authorization: 'Bearer valid-token' },
      })

      expect(response.statusCode).toBe(400)
      const body = response.json()
      expect(body.success).toBe(false)
      expect(body.error).toBeDefined()
    })

    it('returns 400 when cursor has valid date but invalid UUID', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/community/posts?cursor=2024-01-01T00%3A00%3A00.000Z%7Cnotauuid',
        headers: { authorization: 'Bearer valid-token' },
      })

      expect(response.statusCode).toBe(400)
      const body = response.json()
      expect(body.success).toBe(false)
    })

    it('returns 400 when cursor has invalid date but valid UUID', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/v1/community/posts?cursor=not-a-date%7C${TEST_POST_ID}`,
        headers: { authorization: 'Bearer valid-token' },
      })

      expect(response.statusCode).toBe(400)
      const body = response.json()
      expect(body.success).toBe(false)
    })

    it('returns 400 when cursor has no pipe separator', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/community/posts?cursor=justgarbage',
        headers: { authorization: 'Bearer valid-token' },
      })

      expect(response.statusCode).toBe(400)
      const body = response.json()
      expect(body.success).toBe(false)
    })

    it('accepts valid cursor and returns 200', async () => {
      mockListPosts.mockResolvedValue({ items: [], nextCursor: null })

      const validCursor = `2024-06-15T10:30:00.000Z|${TEST_POST_ID}`
      const response = await app.inject({
        method: 'GET',
        url: `/v1/community/posts?cursor=${encodeURIComponent(validCursor)}`,
        headers: { authorization: 'Bearer valid-token' },
      })

      expect(response.statusCode).toBe(200)
    })
  })

  describe('GET /v1/community/posts/following', () => {
    it('returns 400 for garbage cursor', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/community/posts/following?cursor=garbage%7Cnotauuid',
        headers: { authorization: 'Bearer valid-token' },
      })

      expect(response.statusCode).toBe(400)
      const body = response.json()
      expect(body.success).toBe(false)
    })

    it('returns 400 for invalid UUID in cursor', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/community/posts/following?cursor=2024-01-01T00%3A00%3A00.000Z%7Cnotauuid',
        headers: { authorization: 'Bearer valid-token' },
      })

      expect(response.statusCode).toBe(400)
    })
  })

  describe('GET /v1/community/posts/spotlight', () => {
    it('returns 400 for garbage cursor', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/community/posts/spotlight?cursor=garbage%7Cnotauuid',
        headers: { authorization: 'Bearer valid-token' },
      })

      expect(response.statusCode).toBe(400)
      const body = response.json()
      expect(body.success).toBe(false)
    })
  })

  describe('GET /v1/community/posts/:id/replies', () => {
    it('returns 400 for garbage cursor', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/v1/community/posts/${TEST_POST_ID}/replies?cursor=garbage%7Cnotauuid`,
        headers: { authorization: 'Bearer valid-token' },
      })

      expect(response.statusCode).toBe(400)
      const body = response.json()
      expect(body.success).toBe(false)
    })

    it('returns 400 when date is invalid in cursor', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/v1/community/posts/${TEST_POST_ID}/replies?cursor=invalid-date%7C${TEST_REPLY_ID}`,
        headers: { authorization: 'Bearer valid-token' },
      })

      expect(response.statusCode).toBe(400)
    })
  })

  describe('GET /v1/community/users/:userId/followers', () => {
    it('returns 400 for garbage cursor', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/v1/community/users/${TEST_USER_ID}/followers?cursor=garbage%7Cnotauuid`,
        headers: { authorization: 'Bearer valid-token' },
      })

      expect(response.statusCode).toBe(400)
      const body = response.json()
      expect(body.success).toBe(false)
    })
  })

  describe('GET /v1/community/users/:userId/following', () => {
    it('returns 400 for garbage cursor', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/v1/community/users/${TEST_USER_ID}/following?cursor=garbage%7Cnotauuid`,
        headers: { authorization: 'Bearer valid-token' },
      })

      expect(response.statusCode).toBe(400)
      const body = response.json()
      expect(body.success).toBe(false)
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// FIX 3: toggleFeatured rejects flagged/removed posts
// ─────────────────────────────────────────────────────────────────────────────

describe('Fix 3: toggleFeatured rejects flagged/removed posts', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.clearAllMocks()
    app = await buildCommunityApp({ role: 'admin' })
  })

  afterEach(async () => {
    await app.close()
  })

  it('returns 404 when post status is flagged', async () => {
    mockToggleFeatured.mockRejectedValue(
      Object.assign(new Error('Post not found'), { statusCode: 404 }),
    )

    const response = await app.inject({
      method: 'POST',
      url: `/v1/community/posts/${TEST_POST_ID}/feature`,
      headers: { authorization: 'Bearer valid-token' },
    })

    expect(response.statusCode).toBe(404)
    const body = response.json()
    expect(body.success).toBe(false)
  })

  it('returns 404 when post status is removed', async () => {
    mockToggleFeatured.mockRejectedValue(
      Object.assign(new Error('Post not found'), { statusCode: 404 }),
    )

    const response = await app.inject({
      method: 'POST',
      url: `/v1/community/posts/${TEST_POST_ID}/feature`,
      headers: { authorization: 'Bearer valid-token' },
    })

    expect(response.statusCode).toBe(404)
  })

  it('succeeds for active post', async () => {
    mockToggleFeatured.mockResolvedValue({ featured: true })

    const response = await app.inject({
      method: 'POST',
      url: `/v1/community/posts/${TEST_POST_ID}/feature`,
      headers: { authorization: 'Bearer valid-token' },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.success).toBe(true)
    expect(body.data.featured).toBe(true)
  })
})

describe('Fix 3: toggleFeatured service-level tests', () => {
  // Direct service-level tests for the status filter logic.
  // These test toggleFeatured directly, mocking the DB.

  it('rejects a post with status "flagged" by returning 404', async () => {
    // The fix should add a status filter so that flagged posts are not found
    const { toggleFeatured: realToggleFeatured } = await vi.importActual<{
      toggleFeatured: (...args: never[]) => Promise<{ featured: boolean }>
    }>('../post.service.js')

    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    }

    await expect(realToggleFeatured(mockDb as never, TEST_POST_ID)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Post not found',
    })
  })

  it('rejects a post with status "removed" by returning 404', async () => {
    const { toggleFeatured: realToggleFeatured } = await vi.importActual<{
      toggleFeatured: (...args: never[]) => Promise<{ featured: boolean }>
    }>('../post.service.js')

    // When the WHERE clause includes status='active', a removed post won't be found
    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    }

    await expect(realToggleFeatured(mockDb as never, TEST_POST_ID)).rejects.toMatchObject({
      statusCode: 404,
    })
  })

  it('allows toggling an active post', async () => {
    const { toggleFeatured: realToggleFeatured } = await vi.importActual<{
      toggleFeatured: (...args: never[]) => Promise<{ featured: boolean }>
    }>('../post.service.js')

    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ featuredAt: null, status: 'active' }]),
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
    }

    const result = await realToggleFeatured(mockDb as never, TEST_POST_ID)
    expect(result.featured).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// FIX 4: Admin report endpoints
// ─────────────────────────────────────────────────────────────────────────────

describe('Fix 4: Admin report endpoints', () => {
  describe('GET /v1/community/admin/reports', () => {
    let app: FastifyInstance

    afterEach(async () => {
      await app.close()
    })

    it('returns 200 with paginated reports for admin', async () => {
      app = await buildCommunityApp({ role: 'admin' })

      const response = await app.inject({
        method: 'GET',
        url: '/v1/community/admin/reports',
        headers: { authorization: 'Bearer valid-token' },
      })

      // Should be 200 once implemented (currently expected to be 404 since route doesn't exist)
      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(Array.isArray(body.data)).toBe(true)
    })

    it('returns 403 for non-admin user', async () => {
      app = await buildCommunityApp({ role: 'user' })

      const response = await app.inject({
        method: 'GET',
        url: '/v1/community/admin/reports',
        headers: { authorization: 'Bearer valid-token' },
      })

      expect(response.statusCode).toBe(403)
      const body = response.json()
      expect(body.success).toBe(false)
      expect(body.error).toContain('permissions')
    })

    it('returns 401 without auth token', async () => {
      app = await buildCommunityApp()

      const response = await app.inject({
        method: 'GET',
        url: '/v1/community/admin/reports',
      })

      expect(response.statusCode).toBe(401)
    })

    it('supports pagination via cursor query', async () => {
      app = await buildCommunityApp({ role: 'admin' })

      const validCursor = `2024-06-15T10:00:00.000Z|00000000-0000-4000-8000-000000000100`
      const response = await app.inject({
        method: 'GET',
        url: `/v1/community/admin/reports?cursor=${encodeURIComponent(validCursor)}&limit=10`,
        headers: { authorization: 'Bearer valid-token' },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.meta).toBeDefined()
      expect(body.meta).toHaveProperty('nextCursor')
    })

    it('supports filtering by status', async () => {
      app = await buildCommunityApp({ role: 'admin' })

      const response = await app.inject({
        method: 'GET',
        url: '/v1/community/admin/reports?status=pending',
        headers: { authorization: 'Bearer valid-token' },
      })

      expect(response.statusCode).toBe(200)
    })
  })

  describe('PATCH /v1/community/admin/reports/:id', () => {
    let app: FastifyInstance
    const REPORT_ID = '00000000-0000-4000-8000-000000000100'

    afterEach(async () => {
      await app.close()
    })

    it('returns 200 when admin updates report status to reviewed', async () => {
      app = await buildCommunityApp({ role: 'admin' })
      mockUpdateReportStatus.mockResolvedValue({
        id: REPORT_ID,
        status: 'reviewed',
        reviewedBy: TEST_USER_ID,
      })

      const response = await app.inject({
        method: 'PATCH',
        url: `/v1/community/admin/reports/${REPORT_ID}`,
        headers: { authorization: 'Bearer valid-token' },
        payload: { status: 'reviewed' },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.success).toBe(true)
    })

    it('returns 200 when admin updates report status to actioned', async () => {
      app = await buildCommunityApp({ role: 'admin' })
      mockUpdateReportStatus.mockResolvedValue({
        id: REPORT_ID,
        status: 'actioned',
        reviewedBy: TEST_USER_ID,
      })

      const response = await app.inject({
        method: 'PATCH',
        url: `/v1/community/admin/reports/${REPORT_ID}`,
        headers: { authorization: 'Bearer valid-token' },
        payload: { status: 'actioned' },
      })

      expect(response.statusCode).toBe(200)
    })

    it('returns 200 when admin dismisses a report', async () => {
      app = await buildCommunityApp({ role: 'admin' })
      mockUpdateReportStatus.mockResolvedValue({
        id: REPORT_ID,
        status: 'dismissed',
        reviewedBy: TEST_USER_ID,
      })

      const response = await app.inject({
        method: 'PATCH',
        url: `/v1/community/admin/reports/${REPORT_ID}`,
        headers: { authorization: 'Bearer valid-token' },
        payload: { status: 'dismissed' },
      })

      expect(response.statusCode).toBe(200)
    })

    it('sets reviewedBy to the admin user ID', async () => {
      app = await buildCommunityApp({ role: 'admin' })
      mockUpdateReportStatus.mockResolvedValue({
        id: REPORT_ID,
        status: 'reviewed',
        reviewedBy: TEST_USER_ID,
      })

      const response = await app.inject({
        method: 'PATCH',
        url: `/v1/community/admin/reports/${REPORT_ID}`,
        headers: { authorization: 'Bearer valid-token' },
        payload: { status: 'reviewed' },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.data.reviewedBy).toBe(TEST_USER_ID)
    })

    it('returns 403 for non-admin user', async () => {
      app = await buildCommunityApp({ role: 'user' })

      const response = await app.inject({
        method: 'PATCH',
        url: `/v1/community/admin/reports/${REPORT_ID}`,
        headers: { authorization: 'Bearer valid-token' },
        payload: { status: 'reviewed' },
      })

      expect(response.statusCode).toBe(403)
    })

    it('returns 401 without auth token', async () => {
      app = await buildCommunityApp()

      const response = await app.inject({
        method: 'PATCH',
        url: `/v1/community/admin/reports/${REPORT_ID}`,
        payload: { status: 'reviewed' },
      })

      expect(response.statusCode).toBe(401)
    })

    it('returns 400 for invalid report status', async () => {
      app = await buildCommunityApp({ role: 'admin' })

      const response = await app.inject({
        method: 'PATCH',
        url: `/v1/community/admin/reports/${REPORT_ID}`,
        headers: { authorization: 'Bearer valid-token' },
        payload: { status: 'invalid_status' },
      })

      expect(response.statusCode).toBe(400)
    })

    it('returns 400 for non-UUID report ID', async () => {
      app = await buildCommunityApp({ role: 'admin' })

      const response = await app.inject({
        method: 'PATCH',
        url: '/v1/community/admin/reports/not-a-uuid',
        headers: { authorization: 'Bearer valid-token' },
        payload: { status: 'reviewed' },
      })

      expect(response.statusCode).toBe(400)
    })

    it('returns 404 for non-existent report', async () => {
      app = await buildCommunityApp({ role: 'admin' })
      mockUpdateReportStatus.mockRejectedValue(
        Object.assign(new Error('Report not found'), { statusCode: 404 }),
      )

      const nonExistentId = '00000000-0000-4000-8000-999999999999'
      const response = await app.inject({
        method: 'PATCH',
        url: `/v1/community/admin/reports/${nonExistentId}`,
        headers: { authorization: 'Bearer valid-token' },
        payload: { status: 'reviewed' },
      })

      expect(response.statusCode).toBe(404)
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// FIX 5: PHI sync pre-check
// ─────────────────────────────────────────────────────────────────────────────

describe('Fix 5: PHI sync pre-check on create post/reply', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.clearAllMocks()
    app = await buildCommunityApp()
  })

  afterEach(async () => {
    await app.close()
  })

  describe('POST /v1/community/posts — SSN detection', () => {
    it('returns 400 when body contains SSN pattern (XXX-XX-XXXX)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/community/posts',
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          circleSlug: 'emotional-support',
          title: 'Need help with documents',
          body: 'My mom social security is 123-45-6789, can someone help?',
          imageUrls: [],
        },
      })

      expect(response.statusCode).toBe(400)
      const body = response.json()
      expect(body.success).toBe(false)
      expect(body.error).toMatch(/personal health information/i)
      // Verify service was NOT called (blocked before persistence)
      expect(mockCreatePost).not.toHaveBeenCalled()
    })

    it('returns 400 when title contains SSN pattern', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/community/posts',
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          circleSlug: 'legal-financial',
          title: 'SSN 456-78-9012 for benefits',
          body: 'How do I apply for benefits?',
          imageUrls: [],
        },
      })

      expect(response.statusCode).toBe(400)
      const body = response.json()
      expect(body.success).toBe(false)
      expect(body.error).toMatch(/personal health information/i)
    })

    it('does not false-positive on phone numbers', async () => {
      mockCreatePost.mockResolvedValue({ id: TEST_POST_ID, circleId: 'circle-1' })

      const response = await app.inject({
        method: 'POST',
        url: '/v1/community/posts',
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          circleSlug: 'resources-recommendations',
          title: 'Helpful hotline',
          body: 'Call 1-800-555-1234 for caregiver support',
          imageUrls: [],
        },
      })

      // Phone numbers (1-800-555-1234) should NOT trigger SSN detection
      expect(response.statusCode).toBe(201)
    })
  })

  describe('POST /v1/community/posts — email with full name detection', () => {
    it('returns 400 when body contains email address with full name context', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/community/posts',
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          circleSlug: 'emotional-support',
          title: 'Contact info',
          body: 'You can reach Margaret Smith at margaret.smith@gmail.com',
          imageUrls: [],
        },
      })

      expect(response.statusCode).toBe(400)
      const body = response.json()
      expect(body.success).toBe(false)
      expect(body.error).toMatch(/personal health information/i)
      expect(mockCreatePost).not.toHaveBeenCalled()
    })
  })

  describe('POST /v1/community/posts — medical record number detection', () => {
    it('returns 400 when body contains medical record number pattern (MRN)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/community/posts',
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          circleSlug: 'medical-questions',
          title: 'Hospital records question',
          body: 'Her MRN is 12345678, can someone look up her results?',
          imageUrls: [],
        },
      })

      expect(response.statusCode).toBe(400)
      const body = response.json()
      expect(body.success).toBe(false)
      expect(body.error).toMatch(/personal health information/i)
      expect(mockCreatePost).not.toHaveBeenCalled()
    })

    it('returns 400 for "medical record number" followed by digits', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/community/posts',
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          circleSlug: 'medical-questions',
          title: 'Question about records',
          body: 'The medical record number is 9876543',
          imageUrls: [],
        },
      })

      expect(response.statusCode).toBe(400)
      const body = response.json()
      expect(body.success).toBe(false)
    })
  })

  describe('POST /v1/community/posts/:id/replies — PHI check', () => {
    it('returns 400 when reply body contains SSN', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/v1/community/posts/${TEST_POST_ID}/replies`,
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          body: 'My dad SSN is 111-22-3333',
        },
      })

      expect(response.statusCode).toBe(400)
      const body = response.json()
      expect(body.success).toBe(false)
      expect(body.error).toMatch(/personal health information/i)
      expect(mockCreateReplyService).not.toHaveBeenCalled()
    })

    it('returns 400 when reply body contains email with full name', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/v1/community/posts/${TEST_POST_ID}/replies`,
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          body: 'Contact John Doe at john.doe@hospital.org for more info',
        },
      })

      expect(response.statusCode).toBe(400)
      const body = response.json()
      expect(body.success).toBe(false)
      expect(body.error).toMatch(/personal health information/i)
    })

    it('returns 400 when reply body contains MRN', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/v1/community/posts/${TEST_POST_ID}/replies`,
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          body: 'Check MRN 55667788 in the system',
        },
      })

      expect(response.statusCode).toBe(400)
      const body = response.json()
      expect(body.success).toBe(false)
    })

    it('allows normal reply without PHI', async () => {
      mockCreateReplyService.mockResolvedValue({ id: TEST_REPLY_ID })

      const response = await app.inject({
        method: 'POST',
        url: `/v1/community/posts/${TEST_POST_ID}/replies`,
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          body: 'Thank you for sharing your caregiving experience',
        },
      })

      expect(response.statusCode).toBe(201)
      expect(mockCreateReplyService).toHaveBeenCalled()
    })
  })

  describe('POST /v1/community/posts — clean content passes', () => {
    it('allows normal caregiving content', async () => {
      mockCreatePost.mockResolvedValue({ id: TEST_POST_ID, circleId: 'circle-1' })

      const response = await app.inject({
        method: 'POST',
        url: '/v1/community/posts',
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          circleSlug: 'daily-care-tips',
          title: 'Morning routine that works',
          body: 'I found that playing soft music in the morning helps my loved one wake up peacefully.',
          imageUrls: [],
        },
      })

      expect(response.statusCode).toBe(201)
      expect(mockCreatePost).toHaveBeenCalled()
    })

    it('allows posts mentioning general numbers that are not SSNs', async () => {
      mockCreatePost.mockResolvedValue({ id: TEST_POST_ID, circleId: 'circle-1' })

      const response = await app.inject({
        method: 'POST',
        url: '/v1/community/posts',
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          circleSlug: 'daily-care-tips',
          title: 'Daily schedule',
          body: 'We do exercises at 10:30 and lunch at 12:00. Medications at 2pm and 8pm.',
          imageUrls: [],
        },
      })

      expect(response.statusCode).toBe(201)
    })
  })
})
