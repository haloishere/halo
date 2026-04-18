import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../db/schema/index.js'

export type Database = ReturnType<typeof drizzle<typeof schema>>

declare module 'fastify' {
  interface FastifyInstance {
    db: Database
  }
}

export default fp(async (fastify: FastifyInstance) => {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required')
  }

  // #9: Validate DB_POOL_MAX
  const poolMax = parseInt(process.env.DB_POOL_MAX ?? '20', 10)
  if (Number.isNaN(poolMax) || poolMax < 1 || poolMax > 100) {
    throw new Error(`Invalid DB_POOL_MAX: "${process.env.DB_POOL_MAX}". Must be 1-100.`)
  }

  // Production: strict cert verification. Other envs: respect connection string sslmode=require.
  // Setting ssl:false would override sslmode=require, breaking Cloud SQL ENCRYPTED_ONLY.
  //
  // connect_timeout: 30s — matches the Fastify plugin timeout bump in app.ts.
  // Cold-start direct-VPC-egress interface provisioning can take 10–20s
  // before the first TCP connect to Cloud SQL even starts.
  const client = postgres(connectionString, {
    ...(process.env.NODE_ENV === 'production' && { ssl: { rejectUnauthorized: true } }),
    max: poolMax,
    idle_timeout: 30,
    connect_timeout: 30,
  })

  // #8: Verify database connectivity at startup (fail-fast)
  await client`SELECT 1`

  const db = drizzle(client, { schema })
  fastify.decorate('db', db)

  // #20: Wrap onClose in error handling
  fastify.addHook('onClose', async () => {
    try {
      await client.end()
    } catch (err) {
      fastify.log.error({ err }, 'Error closing database connection pool')
    }
  })
})
