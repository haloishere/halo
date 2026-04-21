import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { eq } from 'drizzle-orm'
import { VAULT_TOPICS } from '@halo/shared'
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
    expect(rows.map((r) => r.topic).sort()).toEqual([
      'fashion',
      'food_and_restaurants',
      'lifestyle_and_travel',
    ])
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

  it('rejects NULL topic on vault_entries', async () => {
    await expect(
      sql`INSERT INTO vault_entries (user_id, type, content) VALUES (${testUserId}, 'preference', 'enc:x')`,
    ).rejects.toThrow(/null value in column "topic"/i)
  })

  it('rejects NULL topic on ai_conversations (symmetric with vault_entries)', async () => {
    await expect(
      sql`INSERT INTO ai_conversations (user_id) VALUES (${testUserId})`,
    ).rejects.toThrow(/null value in column "topic"/i)
  })

  it('vault_entries.topic has no column default (no silent backfill on future inserts)', async () => {
    const rows = await sql<
      { column_default: string | null }[]
    >`SELECT column_default FROM information_schema.columns WHERE table_name='vault_entries' AND column_name='topic'`
    expect(rows.length).toBe(1)
    expect(rows[0]!.column_default).toBeNull()
  })

  it('ai_conversations.topic has no column default', async () => {
    const rows = await sql<
      { column_default: string | null }[]
    >`SELECT column_default FROM information_schema.columns WHERE table_name='ai_conversations' AND column_name='topic'`
    expect(rows.length).toBe(1)
    expect(rows[0]!.column_default).toBeNull()
  })

  it('vault_entries_user_topic_idx exists as a partial index on (user_id, topic) WHERE deleted_at IS NULL', async () => {
    const rows = await sql<
      { indexdef: string }[]
    >`SELECT indexdef FROM pg_indexes WHERE tablename = 'vault_entries' AND indexname = 'vault_entries_user_topic_idx'`
    expect(rows.length).toBe(1)
    expect(rows[0]!.indexdef).toMatch(/\(user_id, topic\)/i)
    expect(rows[0]!.indexdef).toMatch(/WHERE \(deleted_at IS NULL\)/i)
  })

  it('ai_conversations_user_topic_idx exists on (user_id, topic) for Phase-3 topic-scoped reads', async () => {
    const rows = await sql<
      { indexdef: string }[]
    >`SELECT indexdef FROM pg_indexes WHERE tablename = 'ai_conversations' AND indexname = 'ai_conversations_user_topic_idx'`
    expect(rows.length).toBe(1)
    expect(rows[0]!.indexdef).toMatch(/\(user_id, topic\)/i)
  })

  it('pg enum values match @halo/shared VAULT_TOPICS exactly (both directions)', async () => {
    // Tuple-wider-than-DB drift test: if someone adds a value to VAULT_TOPICS
    // without a corresponding ALTER TYPE migration, insert-at-runtime failure
    // is the only signal today. This locks parity at build time instead.
    const rows = await sql<
      { value: string }[]
    >`SELECT unnest(enum_range(NULL::vault_topic))::text AS value`
    const dbValues = rows.map((r) => r.value).sort()
    const sharedValues = [...VAULT_TOPICS].sort()
    expect(dbValues).toEqual(sharedValues)
  })
})
