import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { verifyAuth, requireDbUser } from '../../middleware/auth.js'
import {
  getProfile,
  updateOnboarding,
  createCareRecipient,
  listCareRecipients,
  updateCareRecipient,
  deleteCareRecipient,
} from './users.service.js'
import { writeAuditLog } from '../../lib/audit.js'
import {
  onboardingSchema,
  createCareRecipientSchema,
  updateCareRecipientSchema,
} from '@halo/shared'
import { toUserProfile } from './user-profile.js'

export default async function usersRoutes(app: FastifyInstance) {
  const preHandler = [verifyAuth, requireDbUser]

  // GET /v1/users/me
  app.get('/me', { preHandler }, async (request, reply) => {
    const user = await getProfile(request.server.db, request.user.dbUserId!)
    if (!user) return reply.code(404).send({ success: false, error: 'User not found' })
    return reply.send({ success: true, data: toUserProfile(user) })
  })

  // POST /v1/users/me/onboarding
  app.post(
    '/me/onboarding',
    {
      preHandler,
      schema: { body: onboardingSchema },
    },
    async (request, reply) => {
      const userId = request.user.dbUserId!
      const updated = await updateOnboarding(
        request.server.db,
        userId,
        request.body as z.infer<typeof onboardingSchema>,
      )
      await writeAuditLog(
        request.server.db,
        {
          userId,
          action: 'user.onboarding_complete',
          resource: 'user',
          resourceId: userId,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        },
        request.log,
      )
      return reply.send({ success: true, data: toUserProfile(updated) })
    },
  )

  // GET /v1/users/me/care-recipients
  app.get('/me/care-recipients', { preHandler }, async (request, reply) => {
    const userId = request.user.dbUserId!
    const recipients = await listCareRecipients(request.server.db, userId)
    return reply.send({ success: true, data: recipients })
  })

  // POST /v1/users/me/care-recipients
  app.post(
    '/me/care-recipients',
    {
      preHandler,
      schema: { body: createCareRecipientSchema },
    },
    async (request, reply) => {
      const userId = request.user.dbUserId!
      const record = await createCareRecipient(
        request.server.db,
        userId,
        request.body as z.infer<typeof createCareRecipientSchema>,
      )
      await writeAuditLog(
        request.server.db,
        {
          userId,
          action: 'care_recipient.create',
          resource: 'care_recipient',
          resourceId: record.id,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        },
        request.log,
      )
      return reply.code(201).send({ success: true, data: record })
    },
  )

  // PATCH /v1/users/me/care-recipients/:id
  app.patch(
    '/me/care-recipients/:id',
    {
      preHandler,
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: updateCareRecipientSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const userId = request.user.dbUserId!
      const record = await updateCareRecipient(
        request.server.db,
        userId,
        id,
        request.body as z.infer<typeof updateCareRecipientSchema>,
      )
      await writeAuditLog(
        request.server.db,
        {
          userId,
          action: 'care_recipient.update',
          resource: 'care_recipient',
          resourceId: id,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        },
        request.log,
      )
      return reply.send({ success: true, data: record })
    },
  )

  // DELETE /v1/users/me/care-recipients/:id
  app.delete(
    '/me/care-recipients/:id',
    {
      preHandler,
      schema: { params: z.object({ id: z.string().uuid() }) },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const userId = request.user.dbUserId!
      await deleteCareRecipient(request.server.db, userId, id)
      await writeAuditLog(
        request.server.db,
        {
          userId,
          action: 'care_recipient.delete',
          resource: 'care_recipient',
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
