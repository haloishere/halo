import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createTestApp } from '../../../test/helpers.js'

// vi.hoisted makes the mocks available when vi.mock factories run (before imports).
const { mockVerifyIdToken, mockInsertVaultEntry, mockFindByTopic, mockSoftDelete } = vi.hoisted(
  () => ({
    mockVerifyIdToken: vi.fn(),
    mockInsertVaultEntry: vi.fn(),
    mockFindByTopic: vi.fn(),
    mockSoftDelete: vi.fn(),
  }),
)

vi.mock('../../../lib/firebase-admin.js', () => ({
  firebaseAuth: {
    verifyIdToken: mockVerifyIdToken,
    setCustomUserClaims: vi.fn(),
    createUser: vi.fn(),
    getUser: vi.fn(),
    deleteUser: vi.fn(),
    updateUser: vi.fn(),
  },
}))

vi.mock('../vault.service.js', () => ({
  createEntry: mockInsertVaultEntry,
  listEntriesByTopic: mockFindByTopic,
  deleteEntry: mockSoftDelete,
}))

const VALID_TOKEN_UID = 'vault-test-uid'
const DB_USER_ID = '11111111-1111-1111-1111-111111111111'

function makeMockDb() {
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: DB_USER_ID, role: 'user', tier: 'free' }]),
        }),
      }),
    }),
  }
}

async function buildVaultApp() {
  const app = await createTestApp()
  const vaultRoutes = (await import('../vault.routes.js')).default
  app.decorate('db', makeMockDb() as never)
  await app.register(vaultRoutes, { prefix: '/v1/vault' })
  return app
}

function authHeader() {
  return { authorization: 'Bearer valid-token' }
}

const VALID_PREFERENCE = {
  type: 'preference' as const,
  topic: 'food_and_restaurants' as const,
  content: {
    category: 'food' as const,
    subject: 'ramen',
    sentiment: 'likes' as const,
    confidence: 0.95,
  },
}

const VALID_RECORD = {
  id: '22222222-2222-2222-2222-222222222222',
  userId: DB_USER_ID,
  type: 'preference' as const,
  topic: 'food_and_restaurants' as const,
  content: VALID_PREFERENCE.content,
  createdAt: '2026-04-21T10:00:00.000Z',
  updatedAt: '2026-04-21T10:00:00.000Z',
  deletedAt: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockVerifyIdToken.mockResolvedValue({
    uid: VALID_TOKEN_UID,
    email: 'vault@test.com',
    role: 'user',
    tier: 'free',
  })
})

describe('POST /v1/vault/entries', () => {
  it('returns 201 with the persisted record', async () => {
    mockInsertVaultEntry.mockResolvedValue(VALID_RECORD)
    const app = await buildVaultApp()

    const res = await app.inject({
      method: 'POST',
      url: '/v1/vault/entries',
      headers: authHeader(),
      payload: VALID_PREFERENCE,
    })

    expect(res.statusCode).toBe(201)
    const body = JSON.parse(res.body)
    expect(body).toMatchObject({ success: true, data: { id: VALID_RECORD.id, topic: 'food_and_restaurants' } })
    expect(mockInsertVaultEntry).toHaveBeenCalledWith(
      expect.anything(),
      DB_USER_ID,
      expect.objectContaining({ type: 'preference', topic: 'food_and_restaurants' }),
      expect.anything(),
    )
  })

  it('rejects an unknown topic with 400 (Zod)', async () => {
    const app = await buildVaultApp()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/vault/entries',
      headers: authHeader(),
      payload: { ...VALID_PREFERENCE, topic: 'finance' },
    })
    expect(res.statusCode).toBe(400)
    expect(mockInsertVaultEntry).not.toHaveBeenCalled()
  })

  it('returns 401 without an auth header (with a valid body to isolate the auth check)', async () => {
    const app = await buildVaultApp()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/vault/entries',
      payload: VALID_PREFERENCE,
    })
    expect(res.statusCode).toBe(401)
    expect(mockInsertVaultEntry).not.toHaveBeenCalled()
  })
})

describe('GET /v1/vault/entries', () => {
  it('returns 200 with a list of entries when a valid topic is supplied', async () => {
    mockFindByTopic.mockResolvedValue([VALID_RECORD])
    const app = await buildVaultApp()

    const res = await app.inject({
      method: 'GET',
      url: '/v1/vault/entries?topic=food_and_restaurants',
      headers: authHeader(),
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(1)
    expect(body.data[0]).toMatchObject({ topic: 'food_and_restaurants' })
    expect(mockFindByTopic).toHaveBeenCalledWith(
      expect.anything(),
      DB_USER_ID,
      'food_and_restaurants',
      expect.anything(),
    )
  })

  it('rejects an unknown topic query param with 400', async () => {
    const app = await buildVaultApp()
    const res = await app.inject({
      method: 'GET',
      url: '/v1/vault/entries?topic=finance',
      headers: authHeader(),
    })
    expect(res.statusCode).toBe(400)
    expect(mockFindByTopic).not.toHaveBeenCalled()
  })

  it('returns 401 without an auth header', async () => {
    const app = await buildVaultApp()
    const res = await app.inject({
      method: 'GET',
      url: '/v1/vault/entries?topic=food_and_restaurants',
    })
    expect(res.statusCode).toBe(401)
  })
})

describe('DELETE /v1/vault/entries/:id', () => {
  it('returns 204 when the caller owns the entry', async () => {
    mockSoftDelete.mockResolvedValue(undefined)
    const app = await buildVaultApp()

    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/vault/entries/${VALID_RECORD.id}`,
      headers: authHeader(),
    })

    expect(res.statusCode).toBe(204)
    expect(mockSoftDelete).toHaveBeenCalledWith(
      expect.anything(),
      DB_USER_ID,
      VALID_RECORD.id,
      expect.anything(),
    )
  })

  it('returns 404 when the entry is missing / owned by another user', async () => {
    const notFound = Object.assign(new Error('Vault entry not found'), { statusCode: 404 })
    mockSoftDelete.mockRejectedValue(notFound)
    const app = await buildVaultApp()

    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/vault/entries/${VALID_RECORD.id}`,
      headers: authHeader(),
    })

    expect(res.statusCode).toBe(404)
  })

  it('rejects a non-uuid id with 400', async () => {
    const app = await buildVaultApp()
    const res = await app.inject({
      method: 'DELETE',
      url: '/v1/vault/entries/not-a-uuid',
      headers: authHeader(),
    })
    expect(res.statusCode).toBe(400)
    expect(mockSoftDelete).not.toHaveBeenCalled()
  })
})
