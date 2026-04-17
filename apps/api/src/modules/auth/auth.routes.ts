import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { firebaseAuth } from '../../lib/firebase-admin.js'
import { verifyAuth } from '../../middleware/auth.js'
import { registerUser, syncUser } from './auth.service.js'
import { toUserProfile } from '../users/user-profile.js'

const registerBodySchema = z.object({
  idToken: z.string().min(1),
  displayName: z.string().min(1).max(100),
})

const syncBodySchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
})

export default async function authRoutes(app: FastifyInstance) {
  // POST /v1/auth/register — rate limited 3/IP/hour
  app.post(
    '/register',
    {
      config: {
        rateLimit: {
          max: 3,
          timeWindow: '1 hour',
        },
      },
      schema: {
        body: registerBodySchema,
      },
    },
    async (request, reply) => {
      const { idToken, displayName } = request.body as z.infer<typeof registerBodySchema>

      let decodedToken: Awaited<ReturnType<typeof firebaseAuth.verifyIdToken>>
      try {
        decodedToken = await firebaseAuth.verifyIdToken(idToken)
      } catch (err) {
        // Firebase auth errors have code starting with 'auth/' → 401
        // TypeError/RangeError (network failures, SDK bugs) → 503
        const hasAuthCode =
          err instanceof Error &&
          'code' in err &&
          typeof (err as { code: unknown }).code === 'string' &&
          (err as { code: string }).code.startsWith('auth/')
        if (err instanceof TypeError || err instanceof RangeError) {
          request.log.error({ err }, 'Firebase verifyIdToken infrastructure failure')
          return reply
            .code(503)
            .send({ success: false, error: 'Authentication service unavailable' })
        }
        if (!hasAuthCode && !(err instanceof Error)) {
          request.log.error({ err }, 'Firebase verifyIdToken infrastructure failure')
          return reply
            .code(503)
            .send({ success: false, error: 'Authentication service unavailable' })
        }
        return reply.code(401).send({ success: false, error: 'Invalid or expired ID token' })
      }

      const user = await registerUser(
        request.server.db,
        decodedToken.uid,
        decodedToken.email ?? '',
        displayName,
        request.ip,
        request.headers['user-agent'],
      )

      return reply.code(201).send({ success: true, data: toUserProfile(user) })
    },
  )

  // POST /v1/auth/sync — requires valid Firebase token, rate limited 10/min
  // Upserts: creates DB user if not found (single source of truth for all auth flows)
  app.post(
    '/sync',
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
        },
      },
      preHandler: [verifyAuth],
    },
    async (request, reply) => {
      const parsed = syncBodySchema.safeParse(request.body ?? {})
      if (!parsed.success) {
        request.log.warn(
          { errors: parsed.error.flatten().fieldErrors },
          'Invalid sync body — ignoring displayName',
        )
      }
      const displayName = parsed.success ? parsed.data.displayName : undefined
      const user = await syncUser(
        request.server.db,
        request.user.uid,
        request.user.email,
        request.ip,
        request.headers['user-agent'],
        displayName,
      )

      return reply.send({ success: true, data: toUserProfile(user) })
    },
  )
}
