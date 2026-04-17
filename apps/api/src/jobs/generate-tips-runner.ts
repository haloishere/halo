import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import pino from 'pino'
import * as schema from '../db/schema/index.js'
import { createAiClient } from '../lib/vertex-ai.js'
import { generateDailyTips } from './generate-tips.js'

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' })

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    logger.fatal('DATABASE_URL env var is required')
    process.exit(1)
  }

  const client = postgres(databaseUrl, {
    max: 1,
    connect_timeout: 10,
    idle_timeout: 30,
    ...(process.env.NODE_ENV === 'production' && { ssl: { rejectUnauthorized: true } }),
  })
  const db = drizzle(client, { schema })
  const aiClient = createAiClient(logger)

  try {
    await generateDailyTips(db, aiClient, logger)
    logger.info('Daily tips generation complete')
  } catch (err) {
    logger.fatal({ err }, 'Daily tips generation failed')
    process.exit(1)
  } finally {
    await client.end()
  }
}

main()
