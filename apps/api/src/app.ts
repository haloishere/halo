import Fastify from 'fastify'
import type { FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import sensible from '@fastify/sensible'
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod'
import errorHandler from './plugins/error-handler.js'
import drizzlePlugin from './plugins/drizzle.js'
import { buildLoggerConfig } from './lib/logger.js'
import authRoutes from './modules/auth/auth.routes.js'
import otpRoutes from './modules/auth/otp.routes.js'
import usersRoutes from './modules/users/users.routes.js'
import aiChatRoutes from './modules/ai-chat/ai-chat.routes.js'

export interface AppOptions {
  logger?: boolean | object
  skipDb?: boolean
  /** Skip feature route registration (used in route-level unit tests) */
  skipRoutes?: boolean
}

export async function buildApp(options: AppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger ?? buildLoggerConfig(),
    genReqId: () => crypto.randomUUID(),
    requestIdHeader: 'x-request-id',
    bodyLimit: 1_048_576, // 1MB max body size
    trustProxy: 1, // Trust exactly 1 hop (GCP load balancer) — prevents XFF spoofing
  })

  // Zod type provider for request validation
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  // Security & utility plugins
  await app.register(cors, {
    origin: false, // API-only, no browser CORS needed for mobile
  })
  await app.register(helmet)
  await app.register(sensible)
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    // #4: Exempt health check endpoints from rate limiting — Cloud Run probes
    // send frequent liveness/readiness checks that would trigger 429s
    allowList: (req) => req.url === '/healthz' || req.url === '/livez',
  })

  // Error handler
  await app.register(errorHandler)

  // Database (skip in unit tests — integration tests provide DATABASE_URL)
  if (!options.skipDb) {
    await app.register(drizzlePlugin)
  }

  // Feature routes (skipped in route-level unit tests to avoid double registration)
  if (!options.skipRoutes) {
    await app.register(authRoutes, { prefix: '/v1/auth' })
    await app.register(otpRoutes, { prefix: '/v1/auth/otp' })
    await app.register(usersRoutes, { prefix: '/v1/users' })
    await app.register(aiChatRoutes, { prefix: '/v1/ai' })
  }

  // Propagate request ID to response headers for tracing
  app.addHook('onSend', async (request, reply) => {
    reply.header('x-request-id', request.id)
  })

  // Health check endpoints (required for Cloud Run probes)
  app.get('/healthz', async () => ({ status: 'ok' }))
  app.get('/livez', async () => ({ status: 'ok' }))

  return app
}
