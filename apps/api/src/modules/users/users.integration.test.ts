import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { buildApp } from '../../app.js'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../../db/schema/index.js'
import { users, careRecipients } from '../../db/schema/index.js'
import { eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'

const mockVerifyIdToken = vi.fn()

vi.mock('../../lib/firebase-admin.js', () => ({
  firebaseAuth: {
    verifyIdToken: (...args: unknown[]) => mockVerifyIdToken(...args),
    setCustomUserClaims: vi.fn().mockResolvedValue(undefined),
    getUser: vi.fn(),
    createUser: vi.fn(),
    deleteUser: vi.fn(),
    updateUser: vi.fn(),
  },
  getFirebaseAuth: vi.fn(),
}))

const TEST_DB_URL = process.env.DATABASE_URL ?? 'postgresql://test:test@localhost:5434/halo_test'
// Ensure buildApp()'s drizzle plugin can find DATABASE_URL
process.env.DATABASE_URL = TEST_DB_URL
const TEST_UID = 'integration-users-uid'
const TEST_EMAIL = 'users-integration@test.com'

let app: FastifyInstance
let db: ReturnType<typeof drizzle<typeof schema>>
let sql: ReturnType<typeof postgres>
let testUserId: string

beforeAll(async () => {
  sql = postgres(TEST_DB_URL, { max: 5 })
  db = drizzle(sql, { schema })

  // Disable audit log immutability triggers — they block FK cascade cleanup in tests
  await sql`ALTER TABLE audit_logs DISABLE TRIGGER ALL`

  app = await buildApp({ logger: false })
  await app.ready()

  // Create test user in DB
  const [u] = await db
    .insert(users)
    .values({ firebaseUid: TEST_UID, email: TEST_EMAIL, displayName: 'Integration User' })
    .onConflictDoUpdate({
      target: users.firebaseUid,
      set: { email: TEST_EMAIL },
    })
    .returning()
  testUserId = u.id
})

afterAll(async () => {
  await db.delete(careRecipients).where(eq(careRecipients.userId, testUserId))
  await db.delete(users).where(eq(users.firebaseUid, TEST_UID))
  await app.close()
  await sql.end()
})

beforeEach(async () => {
  vi.clearAllMocks()
  await db.delete(careRecipients).where(eq(careRecipients.userId, testUserId))

  mockVerifyIdToken.mockResolvedValue({
    uid: TEST_UID,
    email: TEST_EMAIL,
    role: 'user',
    tier: 'free',
  })
})

function authHeader() {
  return { authorization: 'Bearer test-token' }
}

describe('GET /v1/users/me (integration)', () => {
  it('returns 200 with ApiResponse<UserProfile> envelope', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/users/me',
      headers: authHeader(),
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.success).toBe(true)
    expect(body.data).toMatchObject({
      id: testUserId,
      email: TEST_EMAIL,
    })
  })

  it('returns 401 without token', async () => {
    const response = await app.inject({ method: 'GET', url: '/v1/users/me' })
    expect(response.statusCode).toBe(401)
  })
})

describe('POST /v1/users/me/onboarding (integration)', () => {
  it('sets onboardingCompleted timestamp on valid payload', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/users/me/onboarding',
      headers: authHeader(),
      payload: { displayName: 'Jane', city: 'Luzern' },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.data.onboardingCompleted).toBeTruthy()
    // Documents the Stage 0 intentional gap: `city` accepted via Zod
    // but not persisted until Stage 5 adds the column.
    expect(body.data.city).toBeNull()
  })

  it('returns 400 when city is an empty string', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/users/me/onboarding',
      headers: authHeader(),
      payload: { city: '' },
    })

    expect(response.statusCode).toBe(400)
  })

  it('second call succeeds idempotently (updates timestamp)', async () => {
    for (let i = 0; i < 2; i++) {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/users/me/onboarding',
        headers: authHeader(),
        payload: { city: 'Luzern' },
      })
      expect(response.statusCode).toBe(200)
    }
  })
})

describe('Care recipients (integration)', () => {
  it('POST creates record with ciphertext in DB', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/users/me/care-recipients',
      headers: authHeader(),
      payload: {
        name: 'John Doe',
        relationship: 'spouse',
        diagnosisStage: 'middle',
      },
    })

    expect(response.statusCode).toBe(201)

    // Verify ciphertext stored in DB (not plaintext)
    const [dbRecord] = await db
      .select()
      .from(careRecipients)
      .where(eq(careRecipients.userId, testUserId))
    expect(dbRecord.name).not.toBe('John Doe') // must be encrypted
    expect(dbRecord.name).toMatch(/^local:/) // LocalEncryptionService prefix
  })

  it('GET list returns decrypted names', async () => {
    // Create a record first
    await app.inject({
      method: 'POST',
      url: '/v1/users/me/care-recipients',
      headers: authHeader(),
      payload: { name: 'Jane Smith', relationship: 'child', diagnosisStage: 'early' },
    })

    const response = await app.inject({
      method: 'GET',
      url: '/v1/users/me/care-recipients',
      headers: authHeader(),
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.data[0].name).toBe('Jane Smith')
  })

  it('DELETE non-existent care recipient returns 404', async () => {
    const { randomUUID } = await import('crypto')
    const response = await app.inject({
      method: 'DELETE',
      url: `/v1/users/me/care-recipients/${randomUUID()}`,
      headers: authHeader(),
    })
    expect(response.statusCode).toBe(404)
  })
})
