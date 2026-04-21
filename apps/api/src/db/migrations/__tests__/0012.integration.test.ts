import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { eq } from 'drizzle-orm'
import * as schema from '../../schema/index.js'
import { users, vaultEntries, aiConversations } from '../../schema/index.js'

const TEST_DB_URL = process.env.DATABASE_URL ?? 'postgresql://test:test@localhost:5434/halo_test'
process.env.DATABASE_URL = TEST_DB_URL

const TEST_EMAIL = '0012-vault-topic@test.com'
const TEST_UID = 'integration-0012-vault-topic'

let sql: ReturnType<typeof postgres>
let db: ReturnType<typeof drizzle<typeof schema>>
let testUserId: string

beforeAll(async () => {
  sql = postgres(TEST_DB_URL, { max: 5 })
  db = drizzle(sql, { schema })
  await sql`ALTER TABLE audit_logs DISABLE TRIGGER ALL`

  const [u] = await db
    .insert(users)
    .values({ firebaseUid: TEST_UID, email: TEST_EMAIL, displayName: '0012 User' })
    .onConflictDoUpdate({ target: users.firebaseUid, set: { email: TEST_EMAIL } })
    .returning()
  testUserId = u!.id
})

afterEach(async () => {
  await db.delete(vaultEntries).where(eq(vaultEntries.userId, testUserId))
  await db.delete(aiConversations).where(eq(aiConversations.userId, testUserId))
})

afterAll(async () => {
  await db.delete(users).where(eq(users.firebaseUid, TEST_UID))
  await sql.end()
})

describe('migration 0012 — vault_topic enum', () => {
  it('accepts all three topic values on vault_entries', async () => {
    const topics = ['food_and_restaurants', 'fashion', 'lifestyle_and_travel'] as const
    for (const topic of topics) {
      await db.insert(vaultEntries).values({
        userId: testUserId,
        type: 'preference',
        topic,
        content: 'enc:placeholder',
      })
    }
    const rows = await db.select().from(vaultEntries).where(eq(vaultEntries.userId, testUserId))
    expect(rows.map((r) => r.topic).sort()).toEqual(['fashion', 'food_and_restaurants', 'lifestyle_and_travel'])
  })

  it('rejects an unknown topic on vault_entries (DB-authoritative enum)', async () => {
    // Raw SQL because Drizzle's enum-typed column blocks invalid values at the
    // TS layer before reaching Postgres. The point of this test is the DB gate.
    await expect(
      sql`INSERT INTO vault_entries (user_id, type, topic, content)
          VALUES (${testUserId}, 'preference', 'finance', 'enc:x')`,
    ).rejects.toThrow(/invalid input value for enum vault_topic/i)
  })

  it('rejects an unknown topic on ai_conversations', async () => {
    await expect(
      sql`INSERT INTO ai_conversations (user_id, topic) VALUES (${testUserId}, 'garbage')`,
    ).rejects.toThrow(/invalid input value for enum vault_topic/i)
  })

  it('rejects NULL topic on vault_entries (NOT NULL + DROP DEFAULT)', async () => {
    // DROP DEFAULT in the migration means inserts without an explicit topic fail.
    await expect(
      sql`INSERT INTO vault_entries (user_id, type, content) VALUES (${testUserId}, 'preference', 'enc:x')`,
    ).rejects.toThrow(/null value in column "topic"/i)
  })

  it('vault_entries_user_topic_idx exists and is partial (WHERE deleted_at IS NULL)', async () => {
    const rows = await sql<
      { indexdef: string }[]
    >`SELECT indexdef FROM pg_indexes WHERE tablename = 'vault_entries' AND indexname = 'vault_entries_user_topic_idx'`
    expect(rows.length).toBe(1)
    expect(rows[0]!.indexdef).toMatch(/WHERE \(deleted_at IS NULL\)/i)
  })
})
