import { buildApp } from '../app.js'
import type { FastifyInstance } from 'fastify'

export async function createTestApp(): Promise<FastifyInstance> {
  const app = await buildApp({ logger: false, skipDb: true, skipRoutes: true })
  return app
}
