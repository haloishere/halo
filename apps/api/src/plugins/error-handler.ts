import fp from 'fastify-plugin'
import type { FastifyInstance, FastifyError } from 'fastify'
import { ZodError } from 'zod'
import { Sentry } from '../lib/sentry.js'

// #25: Patterns that indicate internal details leaked in error messages
const INTERNAL_DETAIL_PATTERNS = [
  /relation ".*" does not exist/i,
  /column ".*" does not exist/i,
  /connection refused/i,
  /ECONNREFUSED/i,
  /at character \d+/i,
  /syntax error at or near/i,
]

function isSafeMessage(message: string): boolean {
  return !INTERNAL_DETAIL_PATTERNS.some((pattern) => pattern.test(message))
}

export default fp(async (fastify: FastifyInstance) => {
  fastify.setErrorHandler((error: FastifyError | ZodError, request, reply) => {
    // Zod validation errors → 400
    if (error instanceof ZodError) {
      return reply.status(400).send({
        success: false,
        error: 'Validation failed',
        details: error.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      })
    }

    // Known Fastify errors (from @fastify/sensible)
    const statusCode = error.statusCode ?? 500

    if (statusCode >= 500) {
      // Log full error details server-side
      request.log.error({ err: error }, 'Internal server error')
      // Report to Sentry
      Sentry.captureException(error)
      // Return generic message — never leak internal details
      return reply.status(500).send({
        success: false,
        error: 'Internal server error',
      })
    }

    // #25: Client errors (4xx) — sanitize messages that could leak internal details
    const message = isSafeMessage(error.message)
      ? error.message
      : 'Request failed'

    return reply.status(statusCode).send({
      success: false,
      error: message,
    })
  })
})
