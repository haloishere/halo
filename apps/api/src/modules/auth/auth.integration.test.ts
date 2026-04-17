import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { buildApp } from '../../app.js'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../../db/schema/index.js'
import { users, auditLogs } from '../../db/schema/index.js'
import { eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'

const mockVerifyIdToken = vi.fn()
const mockSetCustomUserClaims = vi.fn()

vi.mock('../../lib/firebase-admin.js', () => ({
  firebaseAuth: {
    verifyIdToken: (...args: unknown[]) => mockVerifyIdToken(...args),
    setCustomUserClaims: (...args: unknown[]) => mockSetCustomUserClaims(...args),
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

let app: FastifyInstance
let db: ReturnType<typeof drizzle<typeof schema>>
let sql: ReturnType<typeof postgres>

const TEST_UID = 'integration-test-uid'
const TEST_EMAIL = 'integration@test.com'

beforeAll(async () => {
  sql = postgres(TEST_DB_URL, { max: 5 })
  db = drizzle(sql, { schema })

  // Disable audit log immutability triggers — they block FK cascade cleanup in tests
  await sql`ALTER TABLE audit_logs DISABLE TRIGGER ALL`

  app = await buildApp({ logger: false })
  await app.ready()
})

afterAll(async () => {
  await db.delete(users).where(eq(users.firebaseUid, TEST_UID))
  await app.close()
  await sql.end()
})

beforeEach(async () => {
  vi.clearAllMocks()
  await db.delete(users).where(eq(users.firebaseUid, TEST_UID))

  mockVerifyIdToken.mockResolvedValue({ uid: TEST_UID, email: TEST_EMAIL })
  mockSetCustomUserClaims.mockResolvedValue(undefined)
})

// NOTE: These integration tests require a running test DB (docker-compose.test.yml).
// Firebase is mocked — no FIREBASE_SERVICE_ACCOUNT_KEY needed.

describe('POST /v1/auth/register (integration)', () => {
  it('creates user in DB and returns 201 with profile', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { idToken: 'test-token', displayName: 'Integration User' },
    })

    expect(response.statusCode).toBe(201)
    const body = response.json()
    expect(body.success).toBe(true)
    expect(body.data.email).toBe(TEST_EMAIL)

    // Verify user row was written
    const [dbUser] = await db.select().from(users).where(eq(users.firebaseUid, TEST_UID))
    expect(dbUser).toBeDefined()
    expect(dbUser.email).toBe(TEST_EMAIL)

    // Verify audit log was written
    const logs = await db.select().from(auditLogs).where(eq(auditLogs.userId, dbUser.id))
    expect(logs.some((l) => l.action === 'user.register')).toBe(true)
  })

  it('returns 400 when displayName is missing', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { idToken: 'token' },
    })
    expect(response.statusCode).toBe(400)
  })

  it('returns 401 for invalid token', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'))

    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { idToken: 'bad-token', displayName: 'User' },
    })
    expect(response.statusCode).toBe(401)
  })
})

describe('POST /v1/auth/sync (integration)', () => {
  it('returns 401 when no Authorization header', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/sync',
    })
    expect(response.statusCode).toBe(401)
  })

  it('returns 401 for expired token', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('Token expired'))

    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/sync',
      headers: { authorization: 'Bearer expired-or-invalid' },
    })
    expect(response.statusCode).toBe(401)
  })
})
