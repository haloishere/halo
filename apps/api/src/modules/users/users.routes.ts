import type { FastifyInstance } from 'fastify'
import type { z } from 'zod'
import { verifyAuth, requireDbUser } from '../../middleware/auth.js'
import { getProfile, updateOnboarding } from './users.service.js'
import { writeAuditLog } from '../../lib/audit.js'
import { onboardingSchema } from '@halo/shared'
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
}
