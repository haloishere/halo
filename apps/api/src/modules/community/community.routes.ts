import type { FastifyInstance, FastifyBaseLogger } from 'fastify'
import type { z } from 'zod'
import { eq } from 'drizzle-orm'
import { verifyAuth, requireDbUser, requireRole } from '../../middleware/auth.js'
import { writeAuditLog } from '../../lib/audit.js'
import type { DrizzleDb } from '../../db/types.js'
import { communityPosts } from '../../db/schema/community-posts.js'
import { communityReplies } from '../../db/schema/community-replies.js'
import {
  postFeedQuerySchema,
  cursorQuerySchema,
  createPostSchema,
  createReplySchema,
  postIdParamsSchema,
  replyIdParamsSchema,
  postReplyParamsSchema,
  userIdParamsSchema,
  reportSchema,
  uploadUrlRequestSchema,
  adminReportQuerySchema,
  adminReportIdParamsSchema,
  adminReportUpdateSchema,
} from '@halo/shared'
import {
  listCircles,
  listPosts,
  listFollowingPosts,
  listSpotlightPosts,
  getPostById,
  createPost,
  deletePost,
  toggleFeatured,
} from './post.service.js'
import { listReplies, createReply, deleteReply } from './reply.service.js'
import { togglePostLike, toggleReplyLike } from './like.service.js'
import { toggleFollow, listFollowers, listFollowing } from './follow.service.js'
import { reportPost, reportReply, listReports, updateReportStatus } from './report.service.js'
import { generateUploadUrl } from './upload.service.js'
import { moderateContent } from './moderation.service.js'
import { detectCrisis } from '../ai-chat/safety/crisis-detector.js'
import { containsPhi } from './phi-detector.js'
import { sanitizeContent } from '../../lib/sanitize.js'
import { parseCursor } from '../../lib/cursor-utils.js'
import type { AiClient } from '../../lib/vertex-ai.js'

export default async function communityRoutes(app: FastifyInstance) {
  const preHandler = [verifyAuth, requireDbUser]
  const adminPreHandler = [verifyAuth, requireDbUser, requireRole('admin')]

  const mediaBucket = process.env.GCS_MEDIA_BUCKET

  // Lazy AI client — only loaded when moderation is needed
  let aiClient: AiClient | null = null
  async function getAiClientSafe(): Promise<AiClient | null> {
    if (aiClient) return aiClient
    try {
      const { getAiClient } = await import('../../lib/vertex-ai.js')
      aiClient = getAiClient()
      return aiClient
    } catch {
      return null
    }
  }

  // ─── Circles ───────────────────────────────────────────────────────────────

  // GET /v1/community/circles
  app.get('/circles', { preHandler }, async (request, reply) => {
    const result = await listCircles(request.server.db, request.log)
    return reply.send({ success: true, data: result })
  })

  // ─── Posts (static paths BEFORE parameterized) ─────────────────────────────

  // GET /v1/community/posts/following
  app.get(
    '/posts/following',
    { preHandler, schema: { querystring: cursorQuerySchema } },
    async (request, reply) => {
      const userId = request.user.dbUserId!
      const filters = request.query as z.infer<typeof cursorQuerySchema>

      if (filters.cursor && !parseCursor(filters.cursor)) {
        return reply.status(400).send({ success: false, error: 'Invalid cursor format' })
      }

      const result = await listFollowingPosts(
        request.server.db,
        userId,
        filters,
        mediaBucket,
        request.log,
      )
      return reply.send({
        success: true,
        data: result.items,
        meta: { nextCursor: result.nextCursor },
      })
    },
  )

  // GET /v1/community/posts/spotlight
  app.get(
    '/posts/spotlight',
    { preHandler, schema: { querystring: cursorQuerySchema } },
    async (request, reply) => {
      const userId = request.user.dbUserId!
      const filters = request.query as z.infer<typeof cursorQuerySchema>

      if (filters.cursor && !parseCursor(filters.cursor)) {
        return reply.status(400).send({ success: false, error: 'Invalid cursor format' })
      }

      const result = await listSpotlightPosts(
        request.server.db,
        userId,
        filters,
        mediaBucket,
        request.log,
      )
      return reply.send({ success: true, data: result })
    },
  )

  // GET /v1/community/posts — explore feed
  app.get(
    '/posts',
    { preHandler, schema: { querystring: postFeedQuerySchema } },
    async (request, reply) => {
      const userId = request.user.dbUserId!
      const filters = request.query as z.infer<typeof postFeedQuerySchema>

      if (filters.cursor && !parseCursor(filters.cursor)) {
        return reply.status(400).send({ success: false, error: 'Invalid cursor format' })
      }

      const result = await listPosts(request.server.db, userId, filters, mediaBucket, request.log)
      return reply.send({
        success: true,
        data: result.items,
        meta: { nextCursor: result.nextCursor },
      })
    },
  )

  // POST /v1/community/posts — create post (async moderation)
  app.post(
    '/posts',
    {
      preHandler,
      schema: { body: createPostSchema },
      config: { rateLimit: { max: 10, timeWindow: '1 hour' } },
    },
    async (request, reply) => {
      const userId = request.user.dbUserId!
      const data = request.body as z.infer<typeof createPostSchema>

      // Validate imageUrls are GCS paths owned by this user
      const imageUrlPattern = /^community\/[0-9a-f-]+\/[0-9a-f-]+\.(jpg|png|webp|heic)$/
      for (const url of data.imageUrls) {
        if (!url.startsWith(`community/${userId}/`) || !imageUrlPattern.test(url)) {
          return reply.status(400).send({ success: false, error: 'Invalid image path' })
        }
      }

      // Sync PHI pre-check — block obvious PHI before persisting
      const fullText = `${sanitizeContent(data.title)} ${sanitizeContent(data.body)}`
      if (containsPhi(fullText)) {
        return reply
          .status(400)
          .send({ success: false, error: 'Content may contain personal health information' })
      }

      const post = await createPost(request.server.db, userId, data, request.log)

      void writeAuditLog(
        request.server.db,
        {
          userId,
          action: 'community.post.create',
          resource: 'community_post',
          resourceId: post.id,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        },
        request.log,
      )

      // Sync crisis detection — surface resources without blocking
      const crisisCheck = detectCrisis(fullText)

      // Async moderation — flag post if content is rejected (use sanitized text)
      void moderateAsync(
        request.server.db,
        getAiClientSafe,
        'community_posts',
        post.id,
        fullText,
        userId,
        request.ip,
        request.headers['user-agent'],
        request.log,
      )

      return reply.status(201).send({
        success: true,
        data: {
          id: post.id,
          ...(crisisCheck.detected && { crisisResources: crisisCheck.resources }),
        },
      })
    },
  )

  // GET /v1/community/posts/:id — post detail
  app.get(
    '/posts/:id',
    { preHandler, schema: { params: postIdParamsSchema } },
    async (request, reply) => {
      const { id } = request.params as z.infer<typeof postIdParamsSchema>
      const userId = request.user.dbUserId!
      const post = await getPostById(request.server.db, id, userId, mediaBucket, request.log)

      if (!post) {
        return reply.status(404).send({ success: false, error: 'Post not found' })
      }

      return reply.send({ success: true, data: post })
    },
  )

  // DELETE /v1/community/posts/:id
  app.delete(
    '/posts/:id',
    { preHandler, schema: { params: postIdParamsSchema } },
    async (request, reply) => {
      const { id } = request.params as z.infer<typeof postIdParamsSchema>
      const userId = request.user.dbUserId!
      const userRole = request.user.role!

      await deletePost(request.server.db, id, userId, userRole, request.log)

      void writeAuditLog(
        request.server.db,
        {
          userId,
          action: 'community.post.delete',
          resource: 'community_post',
          resourceId: id,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        },
        request.log,
      )

      return reply.status(204).send()
    },
  )

  // POST /v1/community/posts/:id/like — toggle
  app.post(
    '/posts/:id/like',
    {
      preHandler,
      schema: { params: postIdParamsSchema },
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const { id } = request.params as z.infer<typeof postIdParamsSchema>
      const userId = request.user.dbUserId!
      const result = await togglePostLike(request.server.db, userId, id, request.log)
      return reply.send({ success: true, data: result })
    },
  )

  // POST /v1/community/posts/:id/feature — admin toggle
  app.post(
    '/posts/:id/feature',
    { preHandler: adminPreHandler, schema: { params: postIdParamsSchema } },
    async (request, reply) => {
      const { id } = request.params as z.infer<typeof postIdParamsSchema>

      const result = await toggleFeatured(request.server.db, id, request.log)

      void writeAuditLog(
        request.server.db,
        {
          userId: request.user.dbUserId,
          action: 'community.post.feature',
          resource: 'community_post',
          resourceId: id,
          metadata: { featured: result.featured },
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        },
        request.log,
      )

      return reply.send({ success: true, data: result })
    },
  )

  // ─── Replies ───────────────────────────────────────────────────────────────

  // GET /v1/community/posts/:id/replies
  app.get(
    '/posts/:id/replies',
    { preHandler, schema: { params: postIdParamsSchema, querystring: cursorQuerySchema } },
    async (request, reply) => {
      const { id } = request.params as z.infer<typeof postIdParamsSchema>
      const userId = request.user.dbUserId!
      const filters = request.query as z.infer<typeof cursorQuerySchema>
      if (filters.cursor && !parseCursor(filters.cursor)) {
        return reply.status(400).send({ success: false, error: 'Invalid cursor format' })
      }

      const result = await listReplies(request.server.db, id, userId, filters, request.log)
      return reply.send({
        success: true,
        data: result.items,
        meta: { nextCursor: result.nextCursor },
      })
    },
  )

  // POST /v1/community/posts/:id/replies — create reply (async moderation)
  app.post(
    '/posts/:id/replies',
    {
      preHandler,
      schema: { params: postIdParamsSchema, body: createReplySchema },
      config: { rateLimit: { max: 20, timeWindow: '1 hour' } },
    },
    async (request, reply) => {
      const { id } = request.params as z.infer<typeof postIdParamsSchema>
      const userId = request.user.dbUserId!
      const { body } = request.body as z.infer<typeof createReplySchema>

      // Sync PHI pre-check (use sanitized text — same as what's persisted)
      const sanitizedBody = sanitizeContent(body)
      if (containsPhi(sanitizedBody)) {
        return reply
          .status(400)
          .send({ success: false, error: 'Content may contain personal health information' })
      }

      const result = await createReply(request.server.db, id, userId, body, request.log)

      void writeAuditLog(
        request.server.db,
        {
          userId,
          action: 'community.reply.create',
          resource: 'community_reply',
          resourceId: result.id,
          metadata: { postId: id },
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        },
        request.log,
      )

      // Sync crisis detection
      const crisisCheck = detectCrisis(sanitizedBody)

      // Async moderation — flag reply if content is rejected (use sanitized text)
      void moderateAsync(
        request.server.db,
        getAiClientSafe,
        'community_replies',
        result.id,
        sanitizedBody,
        userId,
        request.ip,
        request.headers['user-agent'],
        request.log,
      )

      return reply.status(201).send({
        success: true,
        data: {
          id: result.id,
          ...(crisisCheck.detected && { crisisResources: crisisCheck.resources }),
        },
      })
    },
  )

  // DELETE /v1/community/posts/:id/replies/:replyId
  app.delete(
    '/posts/:id/replies/:replyId',
    { preHandler, schema: { params: postReplyParamsSchema } },
    async (request, reply) => {
      const { replyId } = request.params as z.infer<typeof postReplyParamsSchema>
      const userId = request.user.dbUserId!
      const userRole = request.user.role!

      await deleteReply(request.server.db, replyId, userId, userRole, request.log)

      void writeAuditLog(
        request.server.db,
        {
          userId,
          action: 'community.reply.delete',
          resource: 'community_reply',
          resourceId: replyId,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        },
        request.log,
      )

      return reply.status(204).send()
    },
  )

  // ─── Reply Likes ───────────────────────────────────────────────────────────

  // POST /v1/community/replies/:replyId/like — toggle
  app.post(
    '/replies/:replyId/like',
    {
      preHandler,
      schema: { params: replyIdParamsSchema },
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const { replyId } = request.params as z.infer<typeof replyIdParamsSchema>
      const userId = request.user.dbUserId!
      const result = await toggleReplyLike(request.server.db, userId, replyId, request.log)
      return reply.send({ success: true, data: result })
    },
  )

  // ─── Reports ───────────────────────────────────────────────────────────────

  // POST /v1/community/posts/:id/report
  app.post(
    '/posts/:id/report',
    {
      preHandler,
      schema: { params: postIdParamsSchema, body: reportSchema },
      config: { rateLimit: { max: 5, timeWindow: '1 hour' } },
    },
    async (request, reply) => {
      const { id } = request.params as z.infer<typeof postIdParamsSchema>
      const userId = request.user.dbUserId!
      const { reason, details } = request.body as z.infer<typeof reportSchema>

      const result = await reportPost(request.server.db, userId, id, reason, details, request.log)

      if (!result.alreadyReported) {
        void writeAuditLog(
          request.server.db,
          {
            userId,
            action: 'community.post.report',
            resource: 'report',
            resourceId: result.id,
            metadata: { postId: id, reason },
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'],
          },
          request.log,
        )
      }

      return reply
        .status(201)
        .send({ success: true, data: { id: result.id, alreadyReported: result.alreadyReported } })
    },
  )

  // POST /v1/community/replies/:replyId/report
  app.post(
    '/replies/:replyId/report',
    {
      preHandler,
      schema: { params: replyIdParamsSchema, body: reportSchema },
      config: { rateLimit: { max: 5, timeWindow: '1 hour' } },
    },
    async (request, reply) => {
      const { replyId } = request.params as z.infer<typeof replyIdParamsSchema>
      const userId = request.user.dbUserId!
      const { reason, details } = request.body as z.infer<typeof reportSchema>

      const result = await reportReply(
        request.server.db,
        userId,
        replyId,
        reason,
        details,
        request.log,
      )

      if (!result.alreadyReported) {
        void writeAuditLog(
          request.server.db,
          {
            userId,
            action: 'community.reply.report',
            resource: 'report',
            resourceId: result.id,
            metadata: { replyId, reason },
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'],
          },
          request.log,
        )
      }

      return reply
        .status(201)
        .send({ success: true, data: { id: result.id, alreadyReported: result.alreadyReported } })
    },
  )

  // ─── Follows ───────────────────────────────────────────────────────────────

  // POST /v1/community/users/:userId/follow — toggle
  app.post(
    '/users/:userId/follow',
    {
      preHandler,
      schema: { params: userIdParamsSchema },
      config: { rateLimit: { max: 30, timeWindow: '1 hour' } },
    },
    async (request, reply) => {
      const { userId: targetId } = request.params as z.infer<typeof userIdParamsSchema>
      const userId = request.user.dbUserId!
      const result = await toggleFollow(request.server.db, userId, targetId, request.log)
      return reply.send({ success: true, data: result })
    },
  )

  // GET /v1/community/users/:userId/followers
  app.get(
    '/users/:userId/followers',
    { preHandler, schema: { params: userIdParamsSchema, querystring: cursorQuerySchema } },
    async (request, reply) => {
      const { userId: targetId } = request.params as z.infer<typeof userIdParamsSchema>
      const currentUserId = request.user.dbUserId!
      const filters = request.query as z.infer<typeof cursorQuerySchema>

      if (filters.cursor && !parseCursor(filters.cursor)) {
        return reply.status(400).send({ success: false, error: 'Invalid cursor format' })
      }

      const result = await listFollowers(
        request.server.db,
        targetId,
        currentUserId,
        filters,
        request.log,
      )
      return reply.send({
        success: true,
        data: result.items,
        meta: { nextCursor: result.nextCursor },
      })
    },
  )

  // GET /v1/community/users/:userId/following
  app.get(
    '/users/:userId/following',
    { preHandler, schema: { params: userIdParamsSchema, querystring: cursorQuerySchema } },
    async (request, reply) => {
      const { userId: targetId } = request.params as z.infer<typeof userIdParamsSchema>
      const currentUserId = request.user.dbUserId!
      const filters = request.query as z.infer<typeof cursorQuerySchema>

      if (filters.cursor && !parseCursor(filters.cursor)) {
        return reply.status(400).send({ success: false, error: 'Invalid cursor format' })
      }

      const result = await listFollowing(
        request.server.db,
        targetId,
        currentUserId,
        filters,
        request.log,
      )
      return reply.send({
        success: true,
        data: result.items,
        meta: { nextCursor: result.nextCursor },
      })
    },
  )

  // ─── Upload ────────────────────────────────────────────────────────────────

  // POST /v1/community/upload-url
  app.post(
    '/upload-url',
    {
      preHandler,
      schema: { body: uploadUrlRequestSchema },
      config: { rateLimit: { max: 10, timeWindow: '1 hour' } },
    },
    async (request, reply) => {
      const userId = request.user.dbUserId!
      const { contentType } = request.body as z.infer<typeof uploadUrlRequestSchema>

      if (!mediaBucket) {
        return reply.status(503).send({ success: false, error: 'Image upload not configured' })
      }

      const result = await generateUploadUrl(userId, contentType, mediaBucket, request.log)
      return reply.send({ success: true, data: result })
    },
  )

  // ─── Admin: Reports ───────────────────────────────────────────────────────

  // GET /v1/community/admin/reports
  app.get(
    '/admin/reports',
    { preHandler: adminPreHandler, schema: { querystring: adminReportQuerySchema } },
    async (request, reply) => {
      const filters = request.query as z.infer<typeof adminReportQuerySchema>

      if (filters.cursor && !parseCursor(filters.cursor)) {
        return reply.status(400).send({ success: false, error: 'Invalid cursor format' })
      }

      const result = await listReports(request.server.db, filters, request.log)
      return reply.send({
        success: true,
        data: result.items,
        meta: { nextCursor: result.nextCursor },
      })
    },
  )

  // PATCH /v1/community/admin/reports/:id
  app.patch(
    '/admin/reports/:id',
    {
      preHandler: adminPreHandler,
      schema: { params: adminReportIdParamsSchema, body: adminReportUpdateSchema },
    },
    async (request, reply) => {
      const { id: reportId } = request.params as z.infer<typeof adminReportIdParamsSchema>
      const { status } = request.body as z.infer<typeof adminReportUpdateSchema>
      const adminUserId = request.user.dbUserId!

      const result = await updateReportStatus(
        request.server.db,
        reportId,
        status,
        adminUserId,
        request.log,
      )

      void writeAuditLog(
        request.server.db,
        {
          userId: adminUserId,
          action: 'community.report.update',
          resource: 'report',
          resourceId: reportId,
          metadata: { status },
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        },
        request.log,
      )

      return reply.send({ success: true, data: result })
    },
  )
}

// ─── Async Moderation ───────────────────────────────────────────────────────

async function moderateAsync(
  db: DrizzleDb,
  getAiClientSafe: () => Promise<AiClient | null>,
  table: 'community_posts' | 'community_replies',
  resourceId: string,
  text: string,
  userId: string | undefined,
  ipAddress: string,
  userAgent: string | undefined,
  logger?: FastifyBaseLogger,
): Promise<void> {
  try {
    const client = await getAiClientSafe()
    if (!client) {
      logger?.warn({ resourceId, table }, 'Moderation skipped — AI client unavailable')
      void writeAuditLog(
        db,
        {
          userId,
          action: `community.moderation_skipped`,
          resource: table === 'community_posts' ? 'community_post' : 'community_reply',
          resourceId,
          metadata: { reason: 'ai_client_unavailable' },
          ipAddress,
          userAgent,
        },
        logger,
      )
      return
    }

    const modResult = await moderateContent(client, text, logger)

    void writeAuditLog(
      db,
      {
        userId,
        action: `community.moderation`,
        resource: table === 'community_posts' ? 'community_post' : 'community_reply',
        resourceId,
        metadata: {
          approved: modResult.approved,
          ...(!modResult.approved && { category: modResult.category }),
        },
        ipAddress,
        userAgent,
      },
      logger,
    )

    if (!modResult.approved && modResult.category !== 'crisis') {
      const target = table === 'community_posts' ? communityPosts : communityReplies
      await db.update(target).set({ status: 'flagged' }).where(eq(target.id, resourceId))
      logger?.info(
        { resourceId, table, category: modResult.category },
        'Content flagged by moderation',
      )
    }
  } catch (err) {
    logger?.error({ err, resourceId, table }, 'Async moderation failed')
    void writeAuditLog(
      db,
      {
        userId,
        action: `community.moderation_error`,
        resource: table === 'community_posts' ? 'community_post' : 'community_reply',
        resourceId,
        metadata: { error: err instanceof Error ? err.message : 'unknown' },
        ipAddress,
        userAgent,
      },
      logger,
    )
  }
}
