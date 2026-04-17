import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { eq } from 'drizzle-orm'
import * as schema from '../../db/schema/index.js'
import { users, aiConversations, aiMessages, auditLogs } from '../../db/schema/index.js'

// Encryption is orthogonal to the MRU ordering behaviour under test — stub it
// out so the test exercises saveMessage() + listConversations() against a
// real DB without needing ENCRYPTION_DEV_KEY configured.
vi.mock('../../lib/encryption.js', () => ({
  encryption: {
    encryptField: vi.fn((text: string) => Promise.resolve(`enc:${text}`)),
    decryptField: vi.fn((text: string) =>
      Promise.resolve(text.startsWith('enc:') ? text.slice(4) : text),
    ),
  },
}))

const { saveMessage, listConversations } = await import('./ai-chat.service.js')

const TEST_DB_URL = process.env.DATABASE_URL ?? 'postgresql://test:test@localhost:5434/halo_test'
process.env.DATABASE_URL = TEST_DB_URL

let db: ReturnType<typeof drizzle<typeof schema>>
let sql: ReturnType<typeof postgres>

const TEST_FIREBASE_UID = 'ai-chat-integration-uid'
const TEST_EMAIL = 'ai-chat-integration@test.com'
// Second user used by the IDOR defense test — proves saveMessage rolls back
// when called with a conversationId that does not belong to the caller.
const OTHER_FIREBASE_UID = 'ai-chat-integration-other-uid'
const OTHER_EMAIL = 'ai-chat-integration-other@test.com'
let testUserId: string
let otherUserId: string

beforeAll(async () => {
  sql = postgres(TEST_DB_URL, { max: 5 })
  db = drizzle(sql, { schema })

  // audit_logs has immutability triggers that block FK cascade cleanup in tests
  await sql`ALTER TABLE audit_logs DISABLE TRIGGER ALL`

  // Seed the primary test user.
  const [existing] = await db.select().from(users).where(eq(users.firebaseUid, TEST_FIREBASE_UID))
  if (existing) {
    testUserId = existing.id
  } else {
    const [created] = await db
      .insert(users)
      .values({
        firebaseUid: TEST_FIREBASE_UID,
        email: TEST_EMAIL,
        displayName: 'AI Chat Integration User',
      })
      .returning()
    testUserId = created!.id
  }

  // Seed the second user used by the IDOR defense test.
  const [existingOther] = await db
    .select()
    .from(users)
    .where(eq(users.firebaseUid, OTHER_FIREBASE_UID))
  if (existingOther) {
    otherUserId = existingOther.id
  } else {
    const [created] = await db
      .insert(users)
      .values({
        firebaseUid: OTHER_FIREBASE_UID,
        email: OTHER_EMAIL,
        displayName: 'AI Chat Integration Other',
      })
      .returning()
    otherUserId = created!.id
  }
})

afterAll(async () => {
  // Cleanup in reverse FK order (ai_messages cascades from ai_conversations).
  await db.delete(aiConversations).where(eq(aiConversations.userId, testUserId))
  await db.delete(aiConversations).where(eq(aiConversations.userId, otherUserId))
  await db.delete(auditLogs).where(eq(auditLogs.userId, testUserId))
  await db.delete(auditLogs).where(eq(auditLogs.userId, otherUserId))
  await db.delete(users).where(eq(users.firebaseUid, TEST_FIREBASE_UID))
  await db.delete(users).where(eq(users.firebaseUid, OTHER_FIREBASE_UID))
  await sql.end()
})

beforeEach(async () => {
  // Clean conversations between tests so ordering assertions are deterministic.
  await db.delete(aiConversations).where(eq(aiConversations.userId, testUserId))
  await db.delete(aiConversations).where(eq(aiConversations.userId, otherUserId))
})

describe('listConversations (integration) — MRU ordering by updatedAt', () => {
  it('returns conversations ordered by updatedAt desc after saveMessage touches the parent', async () => {
    // Seed three conversations with DISTINCT createdAt AND updatedAt timestamps,
    // where the "oldest activity" comes first by createdAt but the MRU ordering
    // after the write should flip it to the top.
    const base = new Date('2024-06-01T00:00:00Z')
    const threeHoursAgo = new Date(base.getTime() - 3 * 60 * 60 * 1000)
    const twoHoursAgo = new Date(base.getTime() - 2 * 60 * 60 * 1000)
    const oneHourAgo = new Date(base.getTime() - 1 * 60 * 60 * 1000)

    const [oldest] = await db
      .insert(aiConversations)
      .values({
        userId: testUserId,
        title: 'oldest',
        createdAt: threeHoursAgo,
        updatedAt: threeHoursAgo,
      })
      .returning()
    const [middle] = await db
      .insert(aiConversations)
      .values({
        userId: testUserId,
        title: 'middle',
        createdAt: twoHoursAgo,
        updatedAt: twoHoursAgo,
      })
      .returning()
    const [newest] = await db
      .insert(aiConversations)
      .values({
        userId: testUserId,
        title: 'newest',
        createdAt: oneHourAgo,
        updatedAt: oneHourAgo,
      })
      .returning()

    // Sanity check: before the write, listConversations should return newest → middle → oldest.
    const before = await listConversations(db, testUserId)
    expect(before.conversations.map((c) => c.title)).toEqual(['newest', 'middle', 'oldest'])

    // Send a new message into the OLDEST conversation. This is the behaviour
    // that the 2h cold-open resume rule depends on — sending a message must
    // bubble the parent conversation to the top of the MRU list.
    await saveMessage(db, testUserId, oldest!.id, 'user', 'bubble me up')

    const after = await listConversations(db, testUserId)
    expect(after.conversations.map((c) => c.title)).toEqual(['oldest', 'newest', 'middle'])

    // Prove the ordering was driven by updatedAt, not createdAt: the oldest
    // conversation now has the newest updatedAt, while its createdAt is
    // unchanged.
    const bubbled = after.conversations[0]!
    expect(bubbled.id).toBe(oldest!.id)
    expect(bubbled.createdAt.getTime()).toBe(threeHoursAgo.getTime())
    expect(bubbled.updatedAt.getTime()).toBeGreaterThan(oneHourAgo.getTime())

    // Middle and newest should retain their original updatedAt — no sibling
    // rows were touched.
    const middleAfter = after.conversations.find((c) => c.id === middle!.id)!
    const newestAfter = after.conversations.find((c) => c.id === newest!.id)!
    expect(middleAfter.updatedAt.getTime()).toBe(twoHoursAgo.getTime())
    expect(newestAfter.updatedAt.getTime()).toBe(oneHourAgo.getTime())
  })

  it('cursor pagination pages through conversations in updatedAt desc order', async () => {
    // Seed 5 conversations with distinct updatedAt timestamps.
    const now = new Date('2024-06-01T12:00:00Z').getTime()
    const seeded: string[] = []
    for (let i = 0; i < 5; i++) {
      const ts = new Date(now - i * 60 * 1000) // 1 minute apart, descending
      const [c] = await db
        .insert(aiConversations)
        .values({
          userId: testUserId,
          title: `c${i}`,
          createdAt: ts,
          updatedAt: ts,
        })
        .returning()
      seeded.push(c!.id)
    }

    // Page 1: first 2 → c0, c1
    const page1 = await listConversations(db, testUserId, undefined, 2)
    expect(page1.conversations.map((c) => c.title)).toEqual(['c0', 'c1'])
    expect(page1.nextCursor).not.toBeNull()
    // Cursor format must include BOTH the updatedAt and the id tie-break.
    expect(page1.nextCursor).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\|[0-9a-f-]{36}$/)

    // Page 2: from cursor → c2, c3
    const page2 = await listConversations(db, testUserId, page1.nextCursor!, 2)
    expect(page2.conversations.map((c) => c.title)).toEqual(['c2', 'c3'])
    expect(page2.nextCursor).not.toBeNull()

    // Page 3: last one → c4, no more pages
    const page3 = await listConversations(db, testUserId, page2.nextCursor!, 2)
    expect(page3.conversations.map((c) => c.title)).toEqual(['c4'])
    expect(page3.nextCursor).toBeNull()
  })

  it('does NOT drop rows that share the same updatedAt millisecond across a page boundary', async () => {
    // This is the regression-protection test for the cursor tie-break bug.
    // A single-column updatedAt cursor would silently hide the second row
    // when two conversations share the exact same millisecond and straddle
    // a page boundary — because `lt(updatedAt, cursor)` excludes the
    // boundary row permanently.
    //
    // With the composite `(updatedAt, id)` cursor, every row MUST appear
    // on exactly one page, regardless of timestamp collisions.
    const sharedTs = new Date('2024-06-02T10:00:00.123Z')
    const laterTs = new Date('2024-06-02T10:05:00.000Z')
    const earlierTs = new Date('2024-06-02T09:55:00.000Z')

    const [later] = await db
      .insert(aiConversations)
      .values({ userId: testUserId, title: 'later', createdAt: laterTs, updatedAt: laterTs })
      .returning()
    const [collideA] = await db
      .insert(aiConversations)
      .values({ userId: testUserId, title: 'collideA', createdAt: sharedTs, updatedAt: sharedTs })
      .returning()
    const [collideB] = await db
      .insert(aiConversations)
      .values({ userId: testUserId, title: 'collideB', createdAt: sharedTs, updatedAt: sharedTs })
      .returning()
    const [earlier] = await db
      .insert(aiConversations)
      .values({
        userId: testUserId,
        title: 'earlier',
        createdAt: earlierTs,
        updatedAt: earlierTs,
      })
      .returning()

    // Drain the list one page at a time with page size 2. The page boundary
    // will fall BETWEEN the two same-millisecond rows (collideA/collideB).
    // With the broken single-column cursor, the second of those two would
    // be permanently hidden by `lt(updatedAt, cursor)`.
    const allReturned: string[] = []
    let cursor: string | undefined = undefined
    let pages = 0
    const PAGE_SAFETY_LIMIT = 10 // guard against infinite loops if pagination breaks
    do {
      const page = await listConversations(db, testUserId, cursor, 2)
      allReturned.push(...page.conversations.map((c) => c.id))
      cursor = page.nextCursor ?? undefined
      pages++
      if (pages > PAGE_SAFETY_LIMIT) {
        throw new Error(
          `pagination failed to terminate after ${PAGE_SAFETY_LIMIT} pages — cursor loop?`,
        )
      }
    } while (cursor !== undefined)

    // All four rows must appear exactly once across the drained pages.
    expect(allReturned).toHaveLength(4)
    expect(new Set(allReturned).size).toBe(4)
    expect(allReturned).toContain(later!.id)
    expect(allReturned).toContain(collideA!.id)
    expect(allReturned).toContain(collideB!.id)
    expect(allReturned).toContain(earlier!.id)

    // With 4 rows and page size 2, pagination must terminate in exactly 2 pages.
    expect(pages).toBe(2)
  })

  it('saveMessage rolls back the entire transaction when called with a foreign conversation (IDOR defense)', async () => {
    // Seed a conversation owned by the OTHER user. If saveMessage's service
    // layer were unprotected, calling it with (testUserId, otherUser'sConvId)
    // would silently commit an orphaned message row. This test proves:
    //   (a) the call throws (service-layer ownership check fires)
    //   (b) no ai_messages row was persisted (transaction rollback works)
    const [foreignConv] = await db
      .insert(aiConversations)
      .values({
        userId: otherUserId,
        title: 'foreign',
      })
      .returning()

    // Count messages for the foreign conversation BEFORE the call.
    const messagesBefore = await db
      .select()
      .from(aiMessages)
      .where(eq(aiMessages.conversationId, foreignConv!.id))
    expect(messagesBefore).toHaveLength(0)

    // saveMessage must reject the foreign conversation.
    await expect(
      saveMessage(db, testUserId, foreignConv!.id, 'user', 'sneaky message'),
    ).rejects.toThrowError(/Conversation not found/)

    // And no message row must have been persisted — the INSERT was rolled
    // back by the thrown error inside the transaction callback.
    const messagesAfter = await db
      .select()
      .from(aiMessages)
      .where(eq(aiMessages.conversationId, foreignConv!.id))
    expect(messagesAfter).toHaveLength(0)

    // The foreign conversation's updatedAt must be unchanged as well —
    // the UPDATE inside the transaction matched zero rows before the throw.
    const [stillThere] = await db
      .select()
      .from(aiConversations)
      .where(eq(aiConversations.id, foreignConv!.id))
    expect(stillThere).toBeDefined()
    expect(stillThere!.updatedAt.getTime()).toBe(foreignConv!.updatedAt.getTime())
  })
})
