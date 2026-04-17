import { describe, it, expect } from 'vitest'
import {
  postIdParamsSchema,
  replyIdParamsSchema,
  postReplyParamsSchema,
  userIdParamsSchema,
  postFeedQuerySchema,
  cursorQuerySchema,
  createPostSchema,
  createReplySchema,
  reportSchema,
  uploadUrlRequestSchema,
  circleSchema,
  postAuthorSchema,
  postListItemSchema,
  postDetailSchema,
  replySchema,
  followUserSchema,
  uploadUrlResponseSchema,
  adminReportQuerySchema,
  adminReportIdParamsSchema,
  adminReportUpdateSchema,
} from '../community'

// ─── Params ───────────────────────────────────────────────────────────────────

describe('postIdParamsSchema', () => {
  it('accepts valid UUID', () => {
    const result = postIdParamsSchema.safeParse({ id: '550e8400-e29b-41d4-a716-446655440000' })
    expect(result.success).toBe(true)
  })

  it('rejects non-UUID', () => {
    const result = postIdParamsSchema.safeParse({ id: 'not-a-uuid' })
    expect(result.success).toBe(false)
  })
})

describe('replyIdParamsSchema', () => {
  it('accepts valid UUID', () => {
    const result = replyIdParamsSchema.safeParse({
      replyId: '550e8400-e29b-41d4-a716-446655440000',
    })
    expect(result.success).toBe(true)
  })
})

describe('postReplyParamsSchema', () => {
  it('accepts both UUIDs', () => {
    const result = postReplyParamsSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      replyId: '660e8400-e29b-41d4-a716-446655440000',
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing replyId', () => {
    const result = postReplyParamsSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
    })
    expect(result.success).toBe(false)
  })
})

describe('userIdParamsSchema', () => {
  it('accepts valid UUID', () => {
    const result = userIdParamsSchema.safeParse({
      userId: '550e8400-e29b-41d4-a716-446655440000',
    })
    expect(result.success).toBe(true)
  })
})

// ─── Query ────────────────────────────────────────────────────────────────────

describe('postFeedQuerySchema', () => {
  it('accepts empty query with defaults', () => {
    const result = postFeedQuerySchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.limit).toBe(20)
      expect(result.data.circle).toBeUndefined()
      expect(result.data.cursor).toBeUndefined()
    }
  })

  it('accepts valid circle filter', () => {
    const result = postFeedQuerySchema.safeParse({ circle: 'emotional-support' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid circle', () => {
    const result = postFeedQuerySchema.safeParse({ circle: 'invalid-circle' })
    expect(result.success).toBe(false)
  })

  it('accepts composite cursor string', () => {
    const result = postFeedQuerySchema.safeParse({
      cursor: '2026-03-28T08:00:00.000Z|550e8400-e29b-41d4-a716-446655440000',
    })
    expect(result.success).toBe(true)
  })

  it('coerces string limit to number', () => {
    const result = postFeedQuerySchema.safeParse({ limit: '10' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.limit).toBe(10)
  })

  it('rejects limit below 1', () => {
    const result = postFeedQuerySchema.safeParse({ limit: 0 })
    expect(result.success).toBe(false)
  })

  it('rejects limit above 50', () => {
    const result = postFeedQuerySchema.safeParse({ limit: 51 })
    expect(result.success).toBe(false)
  })
})

describe('cursorQuerySchema', () => {
  it('accepts empty query with defaults', () => {
    const result = cursorQuerySchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.limit).toBe(20)
  })

  it('accepts cursor and limit', () => {
    const result = cursorQuerySchema.safeParse({ cursor: 'abc|def', limit: 5 })
    expect(result.success).toBe(true)
  })
})

// ─── Create ───────────────────────────────────────────────────────────────────

describe('createPostSchema', () => {
  it('accepts valid post', () => {
    const result = createPostSchema.safeParse({
      circleSlug: 'emotional-support',
      title: 'Feeling overwhelmed today',
      body: 'I just need to vent about the challenges of caregiving.',
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.imageUrls).toEqual([])
  })

  it('accepts post with images', () => {
    const result = createPostSchema.safeParse({
      circleSlug: 'daily-care-tips',
      title: 'My care setup',
      body: 'Here is how I organize meds.',
      imageUrls: ['community/uid/img1.jpg', 'community/uid/img2.png'],
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty title', () => {
    const result = createPostSchema.safeParse({
      circleSlug: 'emotional-support',
      title: '',
      body: 'Some body text.',
    })
    expect(result.success).toBe(false)
  })

  it('rejects title over 200 chars', () => {
    const result = createPostSchema.safeParse({
      circleSlug: 'emotional-support',
      title: 'a'.repeat(201),
      body: 'Some body text.',
    })
    expect(result.success).toBe(false)
  })

  it('rejects body over 5000 chars', () => {
    const result = createPostSchema.safeParse({
      circleSlug: 'emotional-support',
      title: 'Title',
      body: 'a'.repeat(5001),
    })
    expect(result.success).toBe(false)
  })

  it('rejects more than 3 images', () => {
    const result = createPostSchema.safeParse({
      circleSlug: 'emotional-support',
      title: 'Title',
      body: 'Body',
      imageUrls: ['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg'],
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid circle slug', () => {
    const result = createPostSchema.safeParse({
      circleSlug: 'nonexistent',
      title: 'Title',
      body: 'Body',
    })
    expect(result.success).toBe(false)
  })
})

describe('createReplySchema', () => {
  it('accepts valid reply', () => {
    const result = createReplySchema.safeParse({ body: 'Great post, thanks for sharing!' })
    expect(result.success).toBe(true)
  })

  it('rejects empty body', () => {
    const result = createReplySchema.safeParse({ body: '' })
    expect(result.success).toBe(false)
  })

  it('rejects body over 2000 chars', () => {
    const result = createReplySchema.safeParse({ body: 'a'.repeat(2001) })
    expect(result.success).toBe(false)
  })
})

// ─── Report ───────────────────────────────────────────────────────────────────

describe('reportSchema', () => {
  it('accepts valid report', () => {
    const result = reportSchema.safeParse({ reason: 'spam' })
    expect(result.success).toBe(true)
  })

  it('accepts report with details', () => {
    const result = reportSchema.safeParse({
      reason: 'phi_exposure',
      details: 'Contains patient address.',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid reason', () => {
    const result = reportSchema.safeParse({ reason: 'not-a-reason' })
    expect(result.success).toBe(false)
  })

  it('rejects details over 1000 chars', () => {
    const result = reportSchema.safeParse({
      reason: 'spam',
      details: 'x'.repeat(1001),
    })
    expect(result.success).toBe(false)
  })
})

// ─── Upload ───────────────────────────────────────────────────────────────────

describe('uploadUrlRequestSchema', () => {
  it('accepts valid upload request', () => {
    const result = uploadUrlRequestSchema.safeParse({
      filename: 'photo.jpg',
      contentType: 'image/jpeg',
    })
    expect(result.success).toBe(true)
  })

  it('rejects unsupported content type', () => {
    const result = uploadUrlRequestSchema.safeParse({
      filename: 'doc.pdf',
      contentType: 'application/pdf',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty filename', () => {
    const result = uploadUrlRequestSchema.safeParse({
      filename: '',
      contentType: 'image/png',
    })
    expect(result.success).toBe(false)
  })
})

// ─── Response Schemas ─────────────────────────────────────────────────────────

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'

const validAuthor = {
  id: VALID_UUID,
  displayName: 'Jane',
  caregiverRelationship: 'child',
}

const validPost = {
  id: VALID_UUID,
  title: 'Test post',
  bodySnippet: 'A snippet...',
  imageUrls: [],
  author: validAuthor,
  circleName: 'Emotional Support',
  circleSlug: 'emotional-support',
  likeCount: 5,
  replyCount: 2,
  isLikedByMe: false,
  isFeatured: false,
  createdAt: '2026-03-28T08:00:00.000Z',
}

describe('circleSchema', () => {
  it('accepts valid circle', () => {
    const result = circleSchema.safeParse({
      id: VALID_UUID,
      slug: 'emotional-support',
      name: 'Emotional Support',
      description: 'Share feelings',
      sortOrder: 1,
    })
    expect(result.success).toBe(true)
  })

  it('accepts null description', () => {
    const result = circleSchema.safeParse({
      id: VALID_UUID,
      slug: 'daily-care-tips',
      name: 'Daily Care Tips',
      description: null,
      sortOrder: 2,
    })
    expect(result.success).toBe(true)
  })
})

describe('postListItemSchema', () => {
  it('accepts valid post list item', () => {
    const result = postListItemSchema.safeParse(validPost)
    expect(result.success).toBe(true)
  })
})

describe('postDetailSchema', () => {
  it('accepts valid post detail', () => {
    const result = postDetailSchema.safeParse({
      ...validPost,
      body: 'Full body text.',
      isFollowingAuthor: true,
    })
    expect(result.success).toBe(true)
  })
})

describe('replySchema', () => {
  it('accepts valid reply', () => {
    const result = replySchema.safeParse({
      id: VALID_UUID,
      body: 'Nice post!',
      author: validAuthor,
      likeCount: 0,
      isLikedByMe: false,
      createdAt: '2026-03-28T08:00:00.000Z',
    })
    expect(result.success).toBe(true)
  })
})

describe('followUserSchema', () => {
  it('accepts valid follow user', () => {
    const result = followUserSchema.safeParse({
      id: VALID_UUID,
      displayName: 'Bob',
      caregiverRelationship: null,
      isFollowedByMe: true,
    })
    expect(result.success).toBe(true)
  })
})

describe('uploadUrlResponseSchema', () => {
  it('accepts valid upload response', () => {
    const result = uploadUrlResponseSchema.safeParse({
      uploadUrl: 'https://storage.googleapis.com/signed-url',
      gcsPath: 'community/uid/file.jpg',
      requiredHeaders: { 'x-goog-content-length-range': '0,10485760' },
    })
    expect(result.success).toBe(true)
  })

  // Rejects empty requiredHeaders — a server response with {} would silently
  // disable the upload size guard when spread into the client's PUT headers,
  // so the schema treats it as invalid (see I3 in PR #109 review).
  it('rejects empty requiredHeaders object', () => {
    const result = uploadUrlResponseSchema.safeParse({
      uploadUrl: 'https://storage.googleapis.com/signed-url',
      gcsPath: 'community/uid/file.jpg',
      requiredHeaders: {},
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing requiredHeaders', () => {
    const result = uploadUrlResponseSchema.safeParse({
      uploadUrl: 'https://storage.googleapis.com/signed-url',
      gcsPath: 'community/uid/file.jpg',
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-URL uploadUrl', () => {
    const result = uploadUrlResponseSchema.safeParse({
      uploadUrl: 'not-a-url',
      gcsPath: 'path',
      requiredHeaders: { 'x-goog-content-length-range': '0,10485760' },
    })
    expect(result.success).toBe(false)
  })
})

describe('postAuthorSchema', () => {
  it('accepts valid author', () => {
    const result = postAuthorSchema.safeParse(validAuthor)
    expect(result.success).toBe(true)
  })

  it('accepts null relationship', () => {
    const result = postAuthorSchema.safeParse({
      ...validAuthor,
      caregiverRelationship: null,
    })
    expect(result.success).toBe(true)
  })
})

// ─── Admin Schemas ────────────────────────────────────────────────────────────

describe('adminReportQuerySchema', () => {
  it('accepts empty query with defaults', () => {
    const result = adminReportQuerySchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.limit).toBe(20)
  })

  it('accepts status filter', () => {
    const result = adminReportQuerySchema.safeParse({ status: 'pending' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid status', () => {
    const result = adminReportQuerySchema.safeParse({ status: 'invalid' })
    expect(result.success).toBe(false)
  })
})

describe('adminReportIdParamsSchema', () => {
  it('accepts valid UUID', () => {
    const result = adminReportIdParamsSchema.safeParse({ id: VALID_UUID })
    expect(result.success).toBe(true)
  })

  it('rejects non-UUID', () => {
    const result = adminReportIdParamsSchema.safeParse({ id: 'not-a-uuid' })
    expect(result.success).toBe(false)
  })
})

describe('adminReportUpdateSchema', () => {
  it('accepts valid status update', () => {
    const result = adminReportUpdateSchema.safeParse({ status: 'reviewed' })
    expect(result.success).toBe(true)
  })

  it('accepts actioned status', () => {
    const result = adminReportUpdateSchema.safeParse({ status: 'actioned' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid status', () => {
    const result = adminReportUpdateSchema.safeParse({ status: 'invalid' })
    expect(result.success).toBe(false)
  })
})
