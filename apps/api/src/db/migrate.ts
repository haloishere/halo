import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function runMigrations() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is required')
  }

  // Production: strict cert verification. Other envs: respect connection string sslmode=require.
  // Setting ssl:false would override sslmode=require, breaking Cloud SQL ENCRYPTED_ONLY.
  const client = postgres(connectionString, {
    max: 1,
    ...(process.env.NODE_ENV === 'production' && { ssl: { rejectUnauthorized: true } }),
  })

  try {
    const db = drizzle(client)

    // eslint-disable-next-line no-console
    console.log('Running migrations...')
    await migrate(db, {
      migrationsFolder: path.join(__dirname, '..', '..', 'src', 'db', 'migrations'),
    })
    // eslint-disable-next-line no-console
    console.log('Migrations complete.')
  } finally {
    await client.end()
  }
}

runMigrations().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
