import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { verifyAuth, requireDbUser } from '../../middleware/auth.js'
import { dailyTipSchema } from '@halo/shared'
import { getRandomTip } from './tips.service.js'

const preHandler = [verifyAuth, requireDbUser]

export default async function tipsRoutes(app: FastifyInstance) {
  app.get(
    '/daily',
    {
      preHandler,
      schema: {
        response: {
          200: z.object({
            success: z.literal(true),
            data: dailyTipSchema,
          }),
        },
      },
      config: {
        rateLimit: {
          max: 60,
          timeWindow: '1 hour',
          keyGenerator: (request: { user?: { dbUserId?: string }; ip: string }) =>
            request.user?.dbUserId ?? request.ip,
        },
      },
    },
    async (request, reply) => {
      const tip = await getRandomTip(request.server.db, request.log)
      return reply.send({ success: true, data: tip })
    },
  )
}
