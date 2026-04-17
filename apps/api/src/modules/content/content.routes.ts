import type { FastifyInstance } from 'fastify'
import type { z } from 'zod'
import { verifyAuth, requireDbUser, requireRole } from '../../middleware/auth.js'
import { writeAuditLog } from '../../lib/audit.js'
import {
  contentSearchSchema,
  createContentSchema,
  updateContentSchema,
  contentIdParamsSchema,
  contentSlugParamsSchema,
  progressUpdateSchema,
  bookmarkListSchema,
} from '@halo/shared'
import {
  listContent,
  getContentBySlug,
  createContent,
  updateContent,
  deleteContent,
} from './content.service.js'
import { toggleBookmark, getUserBookmarks } from './bookmark.service.js'
import { updateProgress } from './progress.service.js'

const DEPRECATION_URL = 'https://panel.halo.life/admin'

export default async function contentRoutes(app: FastifyInstance) {
  const preHandler = [verifyAuth, requireDbUser]
  const adminPreHandler = [verifyAuth, requireDbUser, requireRole('admin')]

  // ─── Public (authenticated) routes ──────────────────────────────────────────

  // GET /v1/content — paginated list with filters
  app.get(
    '/',
    {
      preHandler,
      schema: { querystring: contentSearchSchema },
    },
    async (request, reply) => {
      const userId = request.user.dbUserId!
      const filters = request.query as z.infer<typeof contentSearchSchema>

      const result = await listContent(request.server.db, filters, userId, request.log)

      return reply.send({
        success: true,
        data: result.items,
        meta: { nextCursor: result.nextCursor },
      })
    },
  )

  // GET /v1/content/bookmarks — user's bookmarked articles (MUST be before /:slug)
  app.get(
    '/bookmarks',
    { preHandler, schema: { querystring: bookmarkListSchema } },
    async (request, reply) => {
      const userId = request.user.dbUserId!
      const { cursor, limit } = request.query as z.infer<typeof bookmarkListSchema>

      const result = await getUserBookmarks(
        request.server.db,
        userId,
        cursor,
        limit ?? 20,
        request.log,
      )

      return reply.send({
        success: true,
        data: result.items,
        meta: { nextCursor: result.nextCursor },
      })
    },
  )

  // GET /v1/content/:slug — single article detail
  app.get(
    '/:slug',
    {
      preHandler,
      schema: { params: contentSlugParamsSchema },
    },
    async (request, reply) => {
      const userId = request.user.dbUserId!
      const { slug } = request.params as z.infer<typeof contentSlugParamsSchema>

      const item = await getContentBySlug(request.server.db, slug, userId, request.log)

      return reply.send({ success: true, data: item })
    },
  )

  // POST /v1/content/:id/bookmark — toggle bookmark
  app.post(
    '/:id/bookmark',
    {
      preHandler,
      schema: { params: contentIdParamsSchema },
    },
    async (request, reply) => {
      const userId = request.user.dbUserId!
      const { id } = request.params as z.infer<typeof contentIdParamsSchema>

      const result = await toggleBookmark(request.server.db, userId, id, request.log)

      await writeAuditLog(
        request.server.db,
        {
          userId,
          action: result.bookmarked ? 'content.bookmark' : 'content.unbookmark',
          resource: 'bookmark',
          resourceId: id,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        },
        request.log,
      )

      return reply.send({ success: true, data: result })
    },
  )

  // PUT /v1/content/:id/progress — update reading progress
  app.put(
    '/:id/progress',
    {
      preHandler,
      schema: {
        params: contentIdParamsSchema,
        body: progressUpdateSchema,
      },
    },
    async (request, reply) => {
      const userId = request.user.dbUserId!
      const { id } = request.params as z.infer<typeof contentIdParamsSchema>
      const { progressPercent } = request.body as z.infer<typeof progressUpdateSchema>

      const record = await updateProgress(
        request.server.db,
        userId,
        id,
        progressPercent,
        request.log,
      )

      return reply.send({ success: true, data: record })
    },
  )

  // ─── Admin routes (DEPRECATED — use Payload CMS at /admin) ─────────────────
  // These endpoints remain functional for backwards compatibility but will be
  // removed in a future release. All content authoring should go through
  // the Payload CMS admin panel.

  // POST /v1/content — create article [DEPRECATED]
  app.post(
    '/',
    {
      preHandler: adminPreHandler,
      schema: { body: createContentSchema },
    },
    async (request, reply) => {
      reply.header('Deprecation', 'true')
      reply.header('Sunset', '2026-06-30')
      reply.header('Link', `<${DEPRECATION_URL}>; rel="deprecation"`)
      request.log.warn('Deprecated: POST /v1/content — use Payload CMS instead')

      const userId = request.user.dbUserId!
      const data = request.body as z.infer<typeof createContentSchema>

      const record = await createContent(request.server.db, userId, data, request.log)

      await writeAuditLog(
        request.server.db,
        {
          userId,
          action: 'content.create',
          resource: 'content_item',
          resourceId: record.id,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        },
        request.log,
      )

      return reply.code(201).send({ success: true, data: record })
    },
  )

  // PUT /v1/content/:id — update article
  app.put(
    '/:id',
    {
      preHandler: adminPreHandler,
      schema: {
        params: contentIdParamsSchema,
        body: updateContentSchema,
      },
    },
    async (request, reply) => {
      reply.header('Deprecation', 'true')
      reply.header('Sunset', '2026-06-30')
      reply.header('Link', `<${DEPRECATION_URL}>; rel="deprecation"`)
      request.log.warn('Deprecated: PUT /v1/content/:id — use Payload CMS instead')

      const userId = request.user.dbUserId!
      const { id } = request.params as z.infer<typeof contentIdParamsSchema>
      const data = request.body as z.infer<typeof updateContentSchema>

      const record = await updateContent(request.server.db, id, data, request.log)

      await writeAuditLog(
        request.server.db,
        {
          userId,
          action: 'content.update',
          resource: 'content_item',
          resourceId: id,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        },
        request.log,
      )

      return reply.send({ success: true, data: record })
    },
  )

  // DELETE /v1/content/:id — delete article
  app.delete(
    '/:id',
    {
      preHandler: adminPreHandler,
      schema: { params: contentIdParamsSchema },
    },
    async (request, reply) => {
      reply.header('Deprecation', 'true')
      reply.header('Sunset', '2026-06-30')
      reply.header('Link', `<${DEPRECATION_URL}>; rel="deprecation"`)
      request.log.warn('Deprecated: DELETE /v1/content/:id — use Payload CMS instead')

      const userId = request.user.dbUserId!
      const { id } = request.params as z.infer<typeof contentIdParamsSchema>

      await deleteContent(request.server.db, id, request.log)

      await writeAuditLog(
        request.server.db,
        {
          userId,
          action: 'content.delete',
          resource: 'content_item',
          resourceId: id,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        },
        request.log,
      )

      return reply.code(204).send()
    },
  )
}
