import type { FastifyInstance } from 'fastify'
import { sendOtpSchema, verifyOtpSchema } from '@halo/shared'
import crypto from 'node:crypto'
import { createOtp, verifyOtp, cleanupExpiredOtps } from './otp.service.js'
import { toUserProfile } from '../users/user-profile.js'
import { EmailDeliveryError } from '../../lib/errors.js'

const SAFE_401_MESSAGES = new Set([
  'Code expired or not found',
  'Too many attempts. Request a new code.',
  'Invalid code',
])

export default async function otpRoutes(app: FastifyInstance) {
  // POST /v1/auth/otp/send — rate limited 5/IP/hour
  app.post(
    '/send',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '1 hour',
        },
      },
      schema: {
        body: sendOtpSchema,
      },
    },
    async (request, reply) => {
      const { email } = request.body as { email: string }

      // Anti-enumeration: swallow DB/user errors so attackers can't probe emails.
      // But email delivery failures are infrastructure errors — surface them.
      try {
        await createOtp(request.server.db, email, request.ip, request.headers['user-agent'])
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode
        if (statusCode === 429) {
          return reply
            .code(429)
            .send({ success: false, error: 'Too many requests. Please try again later.' })
        }

        if (err instanceof EmailDeliveryError) {
          request.log.error({ err, email: '***' }, 'Email delivery failed')
          return reply.code(500).send({
            success: false,
            error: 'Unable to send verification email. Please try again later.',
          })
        }

        // All other errors swallowed — anti-enumeration
        request.log.error({ err, email: '***' }, 'Failed to create OTP')
      }

      return reply.send({
        success: true,
        message: 'If an account exists, a verification code has been sent.',
      })
    },
  )

  // POST /v1/auth/otp/verify — rate limited 10/IP/hour
  app.post(
    '/verify',
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 hour',
        },
      },
      schema: {
        body: verifyOtpSchema,
      },
    },
    async (request, reply) => {
      const { email, code } = request.body as { email: string; code: string }

      try {
        const result = await verifyOtp(
          request.server.db,
          email,
          code,
          request.ip,
          request.headers['user-agent'],
          request.log,
        )

        return reply.send({
          success: true,
          data: { customToken: result.customToken, user: toUserProfile(result.user) },
        })
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode
        if (statusCode === 401) {
          const message = (err as Error).message
          return reply.code(401).send({
            success: false,
            error: SAFE_401_MESSAGES.has(message) ? message : 'Verification failed',
          })
        }
        request.log.error({ err, email: '***' }, 'OTP verify failed unexpectedly')
        throw new Error('OTP verification failed')
      }
    },
  )

  // DELETE /v1/auth/otp/cleanup — internal, protected by shared secret
  app.delete(
    '/cleanup',
    {
      config: {
        rateLimit: {
          max: 2,
          timeWindow: '1 hour',
        },
      },
    },
    async (request, reply) => {
      const configuredSecret = process.env.CLEANUP_SECRET
      if (!configuredSecret) {
        request.log.error('CLEANUP_SECRET env var not configured')
        return reply.code(500).send({ success: false, error: 'Cleanup not configured' })
      }

      const providedSecret = request.headers['x-cleanup-secret'] as string | undefined
      if (!providedSecret) {
        return reply.code(403).send({ success: false, error: 'Forbidden' })
      }

      // HMAC both values to fixed-length digests — avoids length-leak from Buffer.from
      const hmac = (val: string) => crypto.createHmac('sha256', 'cleanup').update(val).digest()
      if (!crypto.timingSafeEqual(hmac(configuredSecret), hmac(providedSecret))) {
        return reply.code(403).send({ success: false, error: 'Forbidden' })
      }

      try {
        const deleted = await cleanupExpiredOtps(request.server.db)
        return reply.send({ success: true, data: { deleted } })
      } catch (err) {
        request.log.error({ err }, 'OTP cleanup failed')
        return reply.code(500).send({ success: false, error: 'Cleanup failed' })
      }
    },
  )
}
