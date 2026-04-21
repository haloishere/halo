import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { eq } from 'drizzle-orm'
import * as schema from '../../../db/schema/index.js'
import { users, vaultEntries } from '../../../db/schema/index.js'

// Real-DB round-trip tests for vault.repository.
// Unit tests at vault.repository.test.ts mock Drizzle — this file catches
// column-name drift, encryption wiring, and topic propagation end-to-end.

const TEST_DB_URL = process.env.DATABASE_URL ?? 'postgresql://test:test@localhost:5434/halo_test'
process.env.DATABASE_URL = TEST_DB_URL
// Deterministic dev key so the repository's lazy-init encryption service loads
// without touching KMS. Matches the LocalEncryptionService 32-byte requirement.
process.env.ENCRYPTION_DEV_KEY =
  process.env.ENCRYPTION_DEV_KEY ??
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

const TEST_EMAIL = 'vault-repo-integration@test.com'
const TEST_UID = 'integration-vault-repo'

let sql: ReturnType<typeof postgres>
let db: ReturnType<typeof drizzle<typeof schema>>
let testUserId: string

beforeAll(async () => {
  sql = postgres(TEST_DB_URL, { max: 5 })
  db = drizzle(sql, { schema })
  // The repo writes audit rows via `writeAuditLog`; the teardown user-delete
  // cascades those rows, which the append-only triggers from migration 0001
  // would otherwise block. Same pattern as `users.integration.test.ts`.
  await sql`ALTER TABLE audit_logs DISABLE TRIGGER ALL`

  const [u] = await db
    .insert(users)
    .values({ firebaseUid: TEST_UID, email: TEST_EMAIL, displayName: 'Vault Integration' })
    .onConflictDoUpdate({ target: users.firebaseUid, set: { email: TEST_EMAIL } })
    .returning()
  testUserId = u!.id
})

afterEach(async () => {
  await db.delete(vaultEntries).where(eq(vaultEntries.userId, testUserId))
})

afterAll(async () => {
  await db.delete(users).where(eq(users.firebaseUid, TEST_UID))
  // Re-enable the append-only triggers so a downstream integration test in
  // the same worker process doesn't silently run against weakened audit_logs
  // invariants. Disable/enable is idempotent at the SQL level.
  await sql`ALTER TABLE audit_logs ENABLE TRIGGER ALL`
  await sql.end()
})

describe('vault.repository — real-DB round-trip', () => {
  it('insertVaultEntry persists topic and findVaultEntryById returns it unchanged', async () => {
    const { insertVaultEntry, findVaultEntryById } = await import('../vault.repository.js')
    const inserted = await insertVaultEntry(db as never, testUserId, {
      type: 'preference',
      topic: 'fashion',
      content: {
        category: 'lifestyle',
        subject: 'minimalist',
        sentiment: 'likes',
        confidence: 0.9,
      },
    })

    expect(inserted.topic).toBe('fashion')
    expect(inserted.content).toMatchObject({ subject: 'minimalist' })

    const found = await findVaultEntryById(db as never, testUserId, inserted.id)
    expect(found).not.toBeNull()
    expect(found?.topic).toBe('fashion')
    expect(found?.content).toMatchObject({ subject: 'minimalist' })
  })

  it('findVaultEntriesByType returns topic on every row across multiple topics', async () => {
    const { insertVaultEntry, findVaultEntriesByType } = await import('../vault.repository.js')

    await insertVaultEntry(db as never, testUserId, {
      type: 'preference',
      topic: 'food_and_restaurants',
      content: { category: 'food', subject: 'ramen', sentiment: 'likes', confidence: 1 },
    })
    await insertVaultEntry(db as never, testUserId, {
      type: 'preference',
      topic: 'lifestyle_and_travel',
      content: { category: 'place', subject: 'mountains', sentiment: 'likes', confidence: 1 },
    })

    const results = await findVaultEntriesByType(db as never, testUserId, 'preference')
    expect(results).toHaveLength(2)
    const topics = results.map((r) => r.topic).sort()
    expect(topics).toEqual(['food_and_restaurants', 'lifestyle_and_travel'])
  })

  it('softDeleteVaultEntry hides the row from findVaultEntriesByType (partial-index WHERE predicate exercised)', async () => {
    const { insertVaultEntry, softDeleteVaultEntry, findVaultEntriesByType } =
      await import('../vault.repository.js')

    const row = await insertVaultEntry(db as never, testUserId, {
      type: 'preference',
      topic: 'food_and_restaurants',
      content: { category: 'food', subject: 'sushi', sentiment: 'likes', confidence: 1 },
    })

    await softDeleteVaultEntry(db as never, testUserId, row.id)

    const results = await findVaultEntriesByType(db as never, testUserId, 'preference')
    expect(results).toHaveLength(0)
  })

  it('logs when a decrypt fails end-to-end (KMS-level outage surface)', async () => {
    // We can't easily simulate a KMS outage here, but we can force corrupted
    // ciphertext by inserting a row directly. Exercises the same logger path
    // the unit test asserts on, against real Drizzle.
    const { findVaultEntriesByType } = await import('../vault.repository.js')
    const logger = { error: vi.fn(), info: vi.fn(), warn: vi.fn() }

    await db.insert(vaultEntries).values({
      userId: testUserId,
      type: 'preference',
      topic: 'food_and_restaurants',
      content: 'not-a-real-ciphertext',
    })

    const results = await findVaultEntriesByType(
      db as never,
      testUserId,
      'preference',
      logger as never,
    )

    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({ decryptionFailed: true, content: null })
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ userId: testUserId }),
      'vault.decrypt.failed',
    )
  })
})
