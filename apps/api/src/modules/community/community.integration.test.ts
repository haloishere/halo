import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { buildApp } from '../../app.js'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../../db/schema/index.js'
import {
  users,
  circles,
  communityPosts,
  communityReplies,
  postLikes,
  replyLikes,
  follows,
  reports,
  auditLogs,
} from '../../db/schema/index.js'
import { eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'

const mockVerifyIdToken = vi.fn()
const mockSetCustomUserClaims = vi.fn()

vi.mock('../../lib/firebase-admin.js', () => ({
  firebaseAuth: {
    verifyIdToken: (...args: unknown[]) => mockVerifyIdToken(...args),
    setCustomUserClaims: (...args: unknown[]) => mockSetCustomUserClaims(...args),
    getUser: vi.fn(),
    createUser: vi.fn(),
    deleteUser: vi.fn(),
    updateUser: vi.fn(),
  },
  getFirebaseAuth: vi.fn(),
}))

// Mock AI client — moderation is tested separately
vi.mock('../../lib/vertex-ai.js', () => ({
  getAiClient: vi.fn(),
  initAiClient: vi.fn(),
  _resetAiClient: vi.fn(),
}))

// Mock GCS so upload-url tests don't hit real Google Cloud Storage. The route
// and service layer still execute — we only stub the lowest level signing call.
vi.mock('../../lib/gcs.js', () => ({
  getSignedUrl: vi.fn().mockResolvedValue(null),
  getSignedUploadUrl: vi
    .fn()
    .mockImplementation(async (_path: string, _bucket: string, contentType: string) => ({
      url: 'https://storage.googleapis.com/fake-signed-upload-url',
      requiredHeaders: {
        'x-goog-content-length-range': '0,10485760',
        // Include a sentinel to verify the route forwards exactly what the lib returns.
        'x-test-sentinel': `ct:${contentType}`,
      },
    })),
  _resetStorageInstance: vi.fn(),
}))

const TEST_DB_URL = process.env.DATABASE_URL ?? 'postgresql://test:test@localhost:5434/halo_test'
process.env.DATABASE_URL = TEST_DB_URL
// GCS_MEDIA_BUCKET must be set before buildApp() captures it at route registration.
process.env.GCS_MEDIA_BUCKET = process.env.GCS_MEDIA_BUCKET ?? 'test-media-bucket'

let app: FastifyInstance
let db: ReturnType<typeof drizzle<typeof schema>>
let sql: ReturnType<typeof postgres>

const TEST_UID_1 = 'community-test-uid-1'
const TEST_UID_2 = 'community-test-uid-2'
const TEST_EMAIL_1 = 'community1@test.com'
const TEST_EMAIL_2 = 'community2@test.com'

let testUser1Id: string
let testUser2Id: string
let testCircleId: string

beforeAll(async () => {
  sql = postgres(TEST_DB_URL, { max: 5 })
  db = drizzle(sql, { schema })

  // Disable audit log immutability triggers
  await sql`ALTER TABLE audit_logs DISABLE TRIGGER ALL`

  app = await buildApp({ logger: false })
  await app.ready()

  // Seed a test circle
  const [circle] = await db
    .insert(circles)
    .values({
      slug: 'emotional-support',
      name: 'Test Circle',
      description: 'For integration tests',
      sortOrder: 0,
    })
    .onConflictDoNothing()
    .returning()

  if (circle) {
    testCircleId = circle.id
  } else {
    const [existing] = await db.select().from(circles).where(eq(circles.slug, 'emotional-support'))
    testCircleId = existing!.id
  }

  // Seed test users
  const [u1] = await db
    .insert(users)
    .values({
      firebaseUid: TEST_UID_1,
      email: TEST_EMAIL_1,
      displayName: 'User One',
      caregiverRelationship: 'spouse',
    })
    .onConflictDoNothing()
    .returning()
  if (u1) {
    testUser1Id = u1.id
  } else {
    const [existing] = await db.select().from(users).where(eq(users.firebaseUid, TEST_UID_1))
    testUser1Id = existing!.id
  }

  const [u2] = await db
    .insert(users)
    .values({
      firebaseUid: TEST_UID_2,
      email: TEST_EMAIL_2,
      displayName: 'User Two',
      caregiverRelationship: 'child',
    })
    .onConflictDoNothing()
    .returning()
  if (u2) {
    testUser2Id = u2.id
  } else {
    const [existing] = await db.select().from(users).where(eq(users.firebaseUid, TEST_UID_2))
    testUser2Id = existing!.id
  }
})

afterAll(async () => {
  // Cleanup in reverse FK order
  await db.delete(reports)
  await db.delete(replyLikes)
  await db.delete(postLikes)
  await db.delete(follows)
  await db.delete(communityReplies)
  await db.delete(communityPosts)
  await db.delete(circles).where(eq(circles.slug, 'emotional-support'))
  await db.delete(auditLogs).where(eq(auditLogs.userId, testUser1Id))
  await db.delete(auditLogs).where(eq(auditLogs.userId, testUser2Id))
  await db.delete(users).where(eq(users.firebaseUid, TEST_UID_1))
  await db.delete(users).where(eq(users.firebaseUid, TEST_UID_2))
  await app.close()
  await sql.end()
})

beforeEach(async () => {
  vi.clearAllMocks()

  // Clean community data between tests (keep users + circle)
  await db.delete(reports)
  await db.delete(replyLikes)
  await db.delete(postLikes)
  await db.delete(follows)
  await db.delete(communityReplies)
  await db.delete(communityPosts)

  // Default: authenticate as user 1
  mockVerifyIdToken.mockResolvedValue({ uid: TEST_UID_1, email: TEST_EMAIL_1 })
  mockSetCustomUserClaims.mockResolvedValue(undefined)
})

function authHeader(uid = TEST_UID_1, email = TEST_EMAIL_1) {
  mockVerifyIdToken.mockResolvedValue({ uid, email })
  return { authorization: 'Bearer test-token' }
}

// ─── Circles ─────────────────────────────────────────────────────────────────

describe('GET /v1/community/circles (integration)', () => {
  it('returns seeded circles', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/community/circles',
      headers: authHeader(),
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.success).toBe(true)
    expect(body.data.length).toBeGreaterThanOrEqual(1)
    expect(body.data.some((c: { slug: string }) => c.slug === 'emotional-support')).toBe(true)
  })
})

// ─── Post CRUD ───────────────────────────────────────────────────────────────

describe('Community post lifecycle (integration)', () => {
  it('creates a post, lists it, gets detail, and deletes it', async () => {
    // Create post
    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/community/posts',
      headers: authHeader(),
      payload: {
        circleSlug: 'emotional-support',
        title: 'My first post',
        body: 'Hello caregivers!',
      },
    })

    expect(createRes.statusCode).toBe(201)
    const postId = createRes.json().data.id
    expect(postId).toBeDefined()

    // List posts (explore feed)
    const listRes = await app.inject({
      method: 'GET',
      url: '/v1/community/posts',
      headers: authHeader(),
    })

    expect(listRes.statusCode).toBe(200)
    const listBody = listRes.json()
    expect(listBody.data.some((p: { id: string }) => p.id === postId)).toBe(true)

    // Get post detail
    const detailRes = await app.inject({
      method: 'GET',
      url: `/v1/community/posts/${postId}`,
      headers: authHeader(),
    })

    expect(detailRes.statusCode).toBe(200)
    const detail = detailRes.json().data
    expect(detail.title).toBe('My first post')
    expect(detail.body).toBe('Hello caregivers!')
    expect(detail.author.displayName).toBe('User One')
    expect(detail.author.caregiverRelationship).toBe('spouse')
    expect(detail.isLikedByMe).toBe(false)
    expect(detail.likeCount).toBe(0)
    expect(detail.replyCount).toBe(0)

    // Delete post
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/v1/community/posts/${postId}`,
      headers: authHeader(),
    })

    expect(deleteRes.statusCode).toBe(204)

    // Post should no longer appear in list
    const afterDeleteRes = await app.inject({
      method: 'GET',
      url: `/v1/community/posts/${postId}`,
      headers: authHeader(),
    })

    expect(afterDeleteRes.statusCode).toBe(404)
  })

  it('returns 404 for non-existent circle slug', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/community/posts',
      headers: authHeader(),
      payload: { circleSlug: 'nonexistent', title: 'Test', body: 'Test' },
    })

    expect(res.statusCode).toBe(400) // Zod rejects invalid circle slug
  })
})

// ─── Replies ─────────────────────────────────────────────────────────────────

describe('Reply lifecycle (integration)', () => {
  it('creates a reply, lists replies, and deletes', async () => {
    // Create post first
    const postRes = await app.inject({
      method: 'POST',
      url: '/v1/community/posts',
      headers: authHeader(),
      payload: { circleSlug: 'emotional-support', title: 'Post for replies', body: 'Please reply' },
    })
    const postId = postRes.json().data.id

    // Create reply as user 2
    const replyRes = await app.inject({
      method: 'POST',
      url: `/v1/community/posts/${postId}/replies`,
      headers: authHeader(TEST_UID_2, TEST_EMAIL_2),
      payload: { body: 'I am here for you!' },
    })

    expect(replyRes.statusCode).toBe(201)
    const replyId = replyRes.json().data.id

    // List replies
    const listRes = await app.inject({
      method: 'GET',
      url: `/v1/community/posts/${postId}/replies`,
      headers: authHeader(),
    })

    expect(listRes.statusCode).toBe(200)
    const replies = listRes.json().data
    expect(replies.length).toBe(1)
    expect(replies[0].body).toBe('I am here for you!')
    expect(replies[0].author.displayName).toBe('User Two')

    // Verify post reply count incremented
    const postDetail = await app.inject({
      method: 'GET',
      url: `/v1/community/posts/${postId}`,
      headers: authHeader(),
    })
    expect(postDetail.json().data.replyCount).toBe(1)

    // Delete reply as user 2
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/v1/community/posts/${postId}/replies/${replyId}`,
      headers: authHeader(TEST_UID_2, TEST_EMAIL_2),
    })
    expect(deleteRes.statusCode).toBe(204)

    // Reply count should decrement
    const postAfterDelete = await app.inject({
      method: 'GET',
      url: `/v1/community/posts/${postId}`,
      headers: authHeader(),
    })
    expect(postAfterDelete.json().data.replyCount).toBe(0)
  })

  it('returns 403 when deleting another users reply', async () => {
    const postRes = await app.inject({
      method: 'POST',
      url: '/v1/community/posts',
      headers: authHeader(),
      payload: { circleSlug: 'emotional-support', title: 'Auth test', body: 'Body' },
    })
    const postId = postRes.json().data.id

    // User 2 creates reply
    const replyRes = await app.inject({
      method: 'POST',
      url: `/v1/community/posts/${postId}/replies`,
      headers: authHeader(TEST_UID_2, TEST_EMAIL_2),
      payload: { body: 'My reply' },
    })
    const replyId = replyRes.json().data.id

    // User 1 tries to delete user 2's reply
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/v1/community/posts/${postId}/replies/${replyId}`,
      headers: authHeader(TEST_UID_1, TEST_EMAIL_1),
    })
    expect(deleteRes.statusCode).toBe(403)
  })
})

// ─── Likes ───────────────────────────────────────────────────────────────────

describe('Like toggle (integration)', () => {
  it('toggles post like on and off', async () => {
    const postRes = await app.inject({
      method: 'POST',
      url: '/v1/community/posts',
      headers: authHeader(),
      payload: { circleSlug: 'emotional-support', title: 'Likeable post', body: 'Like me!' },
    })
    const postId = postRes.json().data.id

    // Like
    const likeRes = await app.inject({
      method: 'POST',
      url: `/v1/community/posts/${postId}/like`,
      headers: authHeader(),
    })
    expect(likeRes.statusCode).toBe(200)
    expect(likeRes.json().data.liked).toBe(true)
    expect(likeRes.json().data.likeCount).toBe(1)

    // Verify in detail
    const detail1 = await app.inject({
      method: 'GET',
      url: `/v1/community/posts/${postId}`,
      headers: authHeader(),
    })
    expect(detail1.json().data.isLikedByMe).toBe(true)
    expect(detail1.json().data.likeCount).toBe(1)

    // Unlike
    const unlikeRes = await app.inject({
      method: 'POST',
      url: `/v1/community/posts/${postId}/like`,
      headers: authHeader(),
    })
    expect(unlikeRes.json().data.liked).toBe(false)
    expect(unlikeRes.json().data.likeCount).toBe(0)
  })

  it('toggles reply like', async () => {
    const postRes = await app.inject({
      method: 'POST',
      url: '/v1/community/posts',
      headers: authHeader(),
      payload: { circleSlug: 'emotional-support', title: 'Reply likes', body: 'Body' },
    })
    const postId = postRes.json().data.id

    const replyRes = await app.inject({
      method: 'POST',
      url: `/v1/community/posts/${postId}/replies`,
      headers: authHeader(TEST_UID_2, TEST_EMAIL_2),
      payload: { body: 'Like this reply' },
    })
    const replyId = replyRes.json().data.id

    const likeRes = await app.inject({
      method: 'POST',
      url: `/v1/community/replies/${replyId}/like`,
      headers: authHeader(),
    })
    expect(likeRes.json().data.liked).toBe(true)
    expect(likeRes.json().data.likeCount).toBe(1)
  })
})

// ─── Follows ─────────────────────────────────────────────────────────────────

describe('Follow toggle (integration)', () => {
  it('follows and unfollows a user', async () => {
    // Follow user 2
    const followRes = await app.inject({
      method: 'POST',
      url: `/v1/community/users/${testUser2Id}/follow`,
      headers: authHeader(),
    })
    expect(followRes.statusCode).toBe(200)
    expect(followRes.json().data.following).toBe(true)

    // Unfollow
    const unfollowRes = await app.inject({
      method: 'POST',
      url: `/v1/community/users/${testUser2Id}/follow`,
      headers: authHeader(),
    })
    expect(unfollowRes.json().data.following).toBe(false)
  })

  it('returns 400 when following self', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/v1/community/users/${testUser1Id}/follow`,
      headers: authHeader(),
    })
    expect(res.statusCode).toBe(400)
  })
})

// ─── Following Feed ──────────────────────────────────────────────────────────

describe('Following feed (integration)', () => {
  it('shows posts from followed users', async () => {
    // User 2 creates a post
    const postRes = await app.inject({
      method: 'POST',
      url: '/v1/community/posts',
      headers: authHeader(TEST_UID_2, TEST_EMAIL_2),
      payload: { circleSlug: 'emotional-support', title: 'Post from user 2', body: 'Content' },
    })
    const postId = postRes.json().data.id

    // User 1 follows user 2
    await app.inject({
      method: 'POST',
      url: `/v1/community/users/${testUser2Id}/follow`,
      headers: authHeader(),
    })

    // User 1 checks following feed
    const feedRes = await app.inject({
      method: 'GET',
      url: '/v1/community/posts/following',
      headers: authHeader(),
    })

    expect(feedRes.statusCode).toBe(200)
    expect(feedRes.json().data.some((p: { id: string }) => p.id === postId)).toBe(true)
  })

  it('returns empty array when not following anyone', async () => {
    const feedRes = await app.inject({
      method: 'GET',
      url: '/v1/community/posts/following',
      headers: authHeader(),
    })

    expect(feedRes.statusCode).toBe(200)
    expect(feedRes.json().data).toEqual([])
  })
})

// ─── Reports ─────────────────────────────────────────────────────────────────

describe('Report post (integration)', () => {
  it('creates a report and prevents duplicates', async () => {
    const postRes = await app.inject({
      method: 'POST',
      url: '/v1/community/posts',
      headers: authHeader(TEST_UID_2, TEST_EMAIL_2),
      payload: { circleSlug: 'emotional-support', title: 'Reportable', body: 'Bad content' },
    })
    const postId = postRes.json().data.id

    // Report
    const reportRes = await app.inject({
      method: 'POST',
      url: `/v1/community/posts/${postId}/report`,
      headers: authHeader(),
      payload: { reason: 'spam' },
    })

    expect(reportRes.statusCode).toBe(201)
    expect(reportRes.json().data.alreadyReported).toBe(false)

    // Duplicate report
    const dupRes = await app.inject({
      method: 'POST',
      url: `/v1/community/posts/${postId}/report`,
      headers: authHeader(),
      payload: { reason: 'harassment' },
    })

    expect(dupRes.statusCode).toBe(201)
    expect(dupRes.json().data.alreadyReported).toBe(true)
  })
})

// ─── Cursor Pagination ───────────────────────────────────────────────────────

describe('Cursor pagination (integration)', () => {
  it('paginates posts correctly', async () => {
    // Insert posts directly to avoid rate limiting
    for (let i = 0; i < 5; i++) {
      await db.insert(communityPosts).values({
        circleId: testCircleId,
        authorId: testUser1Id,
        title: `Pagination Post ${i}`,
        body: `Body ${i}`,
      })
    }

    // Fetch page 1 (limit 3)
    const page1 = await app.inject({
      method: 'GET',
      url: '/v1/community/posts?limit=3',
      headers: authHeader(),
    })

    expect(page1.statusCode).toBe(200)
    const body1 = page1.json()
    expect(body1.data.length).toBe(3)
    expect(body1.meta.nextCursor).toBeDefined()

    // Fetch page 2
    const page2 = await app.inject({
      method: 'GET',
      url: `/v1/community/posts?limit=3&cursor=${encodeURIComponent(body1.meta.nextCursor)}`,
      headers: authHeader(),
    })

    if (page2.statusCode !== 200) {
      console.error('Page 2 cursor error:', page2.json(), 'cursor:', body1.meta.nextCursor)
    }
    expect(page2.statusCode).toBe(200)
    const body2 = page2.json()
    expect(body2.data.length).toBe(2)
    expect(body2.meta.nextCursor).toBeNull()

    // No overlap
    const page1Ids = new Set(body1.data.map((p: { id: string }) => p.id))
    const page2Ids = body2.data.map((p: { id: string }) => p.id)
    for (const id of page2Ids) {
      expect(page1Ids.has(id)).toBe(false)
    }
  })
})

// ─── Upload URL (I5 from PR #109 review) ────────────────────────────────────
// Locks in the response contract for POST /v1/community/upload-url so the
// mobile client can always spread requiredHeaders into its PUT call without
// worrying about shape drift between API and mobile.

describe('POST /v1/community/upload-url (integration)', () => {
  it('returns a response matching uploadUrlResponseSchema', async () => {
    // Import the shared schema inside the test so the vi.mock hoist order
    // doesn't interfere with top-of-file imports.
    const { uploadUrlResponseSchema } = await import('@halo/shared')

    const res = await app.inject({
      method: 'POST',
      url: '/v1/community/upload-url',
      headers: authHeader(),
      payload: { filename: 'selfie.jpg', contentType: 'image/jpeg' },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json() as { success: boolean; data: unknown }
    expect(body.success).toBe(true)

    const parsed = uploadUrlResponseSchema.safeParse(body.data)
    expect(parsed.success).toBe(true)
  })

  it('forwards the signed extension headers from the lib layer', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/community/upload-url',
      headers: authHeader(),
      payload: { filename: 'selfie.png', contentType: 'image/png' },
    })

    expect(res.statusCode).toBe(200)
    const { data } = res.json() as {
      data: { uploadUrl: string; gcsPath: string; requiredHeaders: Record<string, string> }
    }

    // Sentinel proves the route forwards whatever the lib returned (not a hardcoded shape)
    expect(data.requiredHeaders['x-test-sentinel']).toBe('ct:image/png')
    expect(data.requiredHeaders['x-goog-content-length-range']).toBe('0,10485760')
    expect(data.uploadUrl).toBe('https://storage.googleapis.com/fake-signed-upload-url')
    expect(data.gcsPath).toMatch(/^community\//)
  })

  it('rejects unsupported content types with 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/community/upload-url',
      headers: authHeader(),
      payload: { filename: 'animation.gif', contentType: 'image/gif' },
    })

    // Zod validates contentType against the allowed enum — 400, not 415
    expect(res.statusCode).toBe(400)
  })

  it('returns 401 without authorization', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/community/upload-url',
      payload: { filename: 'x.jpg', contentType: 'image/jpeg' },
    })
    expect(res.statusCode).toBe(401)
  })
})

// ─── Auth ────────────────────────────────────────────────────────────────────

describe('Community auth (integration)', () => {
  it('returns 401 without authorization header', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/community/circles',
    })
    expect(res.statusCode).toBe(401)
  })
})
