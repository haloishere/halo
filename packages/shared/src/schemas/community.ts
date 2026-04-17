import { z } from 'zod'
import { COMMUNITY_CIRCLES, REPORT_REASONS, REPORT_STATUSES } from '../constants/enums.js'

// ─── Params ──────────────────────────────────────────────────────────────────

export const postIdParamsSchema = z.object({
  id: z.string().uuid(),
})

export const replyIdParamsSchema = z.object({
  replyId: z.string().uuid(),
})

export const postReplyParamsSchema = z.object({
  id: z.string().uuid(),
  replyId: z.string().uuid(),
})

export const userIdParamsSchema = z.object({
  userId: z.string().uuid(),
})

// ─── Query ───────────────────────────────────────────────────────────────────

export const postFeedQuerySchema = z.object({
  circle: z.enum(COMMUNITY_CIRCLES).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export const cursorQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

// ─── Create ──────────────────────────────────────────────────────────────────

export const createPostSchema = z.object({
  circleSlug: z.enum(COMMUNITY_CIRCLES),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
  imageUrls: z.array(z.string().max(500)).max(3).default([]),
})

export const createReplySchema = z.object({
  body: z.string().min(1).max(2000),
})

// ─── Report ──────────────────────────────────────────────────────────────────

export const reportSchema = z.object({
  reason: z.enum(REPORT_REASONS),
  details: z.string().max(1000).optional(),
})

// ─── Upload ──────────────────────────────────────────────────────────────────

export const uploadUrlRequestSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/heic']),
})

// ─── Response Types ──────────────────────────────────────────────────────────

export const circleSchema = z.object({
  id: z.string().uuid(),
  slug: z.enum(COMMUNITY_CIRCLES),
  name: z.string(),
  description: z.string().nullable(),
  sortOrder: z.number().int(),
})

export const postAuthorSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string(),
  caregiverRelationship: z.string().nullable(),
})

export const postListItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  bodySnippet: z.string(),
  imageUrls: z.array(z.string()),
  author: postAuthorSchema,
  circleName: z.string(),
  circleSlug: z.string(),
  likeCount: z.number().int(),
  replyCount: z.number().int(),
  isLikedByMe: z.boolean(),
  isFeatured: z.boolean(),
  createdAt: z.string(),
})

export const postDetailSchema = postListItemSchema.extend({
  body: z.string(),
  isFollowingAuthor: z.boolean(),
})

export const replySchema = z.object({
  id: z.string().uuid(),
  body: z.string(),
  author: postAuthorSchema,
  likeCount: z.number().int(),
  isLikedByMe: z.boolean(),
  createdAt: z.string(),
})

export const followUserSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string(),
  caregiverRelationship: z.string().nullable(),
  isFollowedByMe: z.boolean(),
})

export const uploadUrlResponseSchema = z.object({
  uploadUrl: z.string().url(),
  gcsPath: z.string(),
  /**
   * Signed headers that the client MUST send on the PUT request to GCS,
   * verbatim, or GCS returns 403 SignatureDoesNotMatch. The concrete set
   * is determined server-side (see `getSignedUploadUrl` in apps/api/src/lib/gcs.ts)
   * — mobile clients should spread this record into fetch headers and not
   * hardcode any particular key.
   *
   * Must be non-empty: an empty record would silently disable the upload
   * size guard on the client side, so we treat it as invalid.
   */
  requiredHeaders: z.record(z.string(), z.string()).refine((h) => Object.keys(h).length > 0, {
    message: 'requiredHeaders must contain at least one signed header',
  }),
})

// ─── Admin ───────────────────────────────────────────────────────────────────

export const adminReportQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: z.enum(REPORT_STATUSES).optional(),
})

export const adminReportIdParamsSchema = z.object({
  id: z.string().uuid(),
})

export const adminReportUpdateSchema = z.object({
  status: z.enum(REPORT_STATUSES),
})

// ─── Inferred Types ──────────────────────────────────────────────────────────

export type CreatePost = z.infer<typeof createPostSchema>
export type CreateReply = z.infer<typeof createReplySchema>
export type Report = z.infer<typeof reportSchema>
export type UploadUrlRequest = z.infer<typeof uploadUrlRequestSchema>
export type Circle = z.infer<typeof circleSchema>
export type PostAuthor = z.infer<typeof postAuthorSchema>
export type PostListItem = z.infer<typeof postListItemSchema>
export type PostDetail = z.infer<typeof postDetailSchema>
export type Reply = z.infer<typeof replySchema>
export type FollowUser = z.infer<typeof followUserSchema>
export type UploadUrlResponse = z.infer<typeof uploadUrlResponseSchema>
export type PostFeedQuery = z.infer<typeof postFeedQuerySchema>
export type CursorQuery = z.infer<typeof cursorQuerySchema>
