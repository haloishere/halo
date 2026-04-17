import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createTestApp } from '../../test/helpers.js'
import { createUserFactory } from '../../test/factories/index.js'

// vi.hoisted ensures these mocks are available when vi.mock factories run
const { mockVerifyIdToken, mockRegisterUser, mockSyncUser } = vi.hoisted(() => ({
  mockVerifyIdToken: vi.fn(),
  mockRegisterUser: vi.fn(),
  mockSyncUser: vi.fn(),
}))

vi.mock('../../lib/firebase-admin.js', () => ({
  firebaseAuth: {
    verifyIdToken: mockVerifyIdToken,
    setCustomUserClaims: vi.fn(),
    createUser: vi.fn(),
    getUser: vi.fn(),
    deleteUser: vi.fn(),
    updateUser: vi.fn(),
  },
}))

vi.mock('./auth.service.js', () => ({
  registerUser: mockRegisterUser,
  syncUser: mockSyncUser,
}))

async function buildAuthApp() {
  const app = await createTestApp()
  app.decorate('db', {} as never)
  const authRoutes = (await import('./auth.routes.js')).default
  await app.register(authRoutes, { prefix: '/v1/auth' })
  return app
}

describe('POST /v1/auth/register', () => {
  let app: Awaited<ReturnType<typeof buildAuthApp>>

  beforeEach(async () => {
    vi.clearAllMocks()
    app = await buildAuthApp()
  })

  it('returns 201 with user profile on valid token and displayName', async () => {
    const user = createUserFactory()
    mockVerifyIdToken.mockResolvedValue({ uid: user.firebaseUid, email: user.email })
    mockRegisterUser.mockResolvedValue(user)

    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { idToken: 'valid-token', displayName: 'Test User' },
    })

    expect(response.statusCode).toBe(201)
    const body = response.json()
    expect(body.success).toBe(true)
    expect(body.data.id).toBe(user.id)
  })

  it('returns 401 when idToken is invalid (auth error)', async () => {
    mockVerifyIdToken.mockRejectedValue(
      Object.assign(new Error('Invalid token'), { code: 'auth/argument-error' }),
    )

    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { idToken: 'bad-token', displayName: 'Test User' },
    })

    expect(response.statusCode).toBe(401)
  })

  it('returns 503 when verifyIdToken fails with infra error', async () => {
    mockVerifyIdToken.mockRejectedValue(new TypeError('fetch failed'))

    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { idToken: 'valid-token', displayName: 'Test User' },
    })

    expect(response.statusCode).toBe(503)
    expect(response.json().error).toBe('Authentication service unavailable')
  })

  it('returns 400 when displayName is missing', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { idToken: 'valid-token' },
    })

    expect(response.statusCode).toBe(400)
  })

  it('returns 409 when registerUser throws email conflict', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'uid', email: 'dup@test.com' })
    mockRegisterUser.mockRejectedValue(
      Object.assign(new Error('This email is already associated with another account'), {
        statusCode: 409,
      }),
    )

    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { idToken: 'valid-token', displayName: 'Test User' },
    })

    expect(response.statusCode).toBe(409)
    expect(response.json().success).toBe(false)
  })

  it('handles duplicate firebaseUid (upsert) without error', async () => {
    const user = createUserFactory()
    mockVerifyIdToken.mockResolvedValue({ uid: user.firebaseUid, email: user.email })
    mockRegisterUser.mockResolvedValue(user)

    for (let i = 0; i < 2; i++) {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/register',
        payload: { idToken: 'valid-token', displayName: 'Same User' },
      })
      expect(response.statusCode).toBe(201)
    }
  })
})

describe('POST /v1/auth/sync', () => {
  let app: Awaited<ReturnType<typeof buildAuthApp>>

  beforeEach(async () => {
    vi.clearAllMocks()
    app = await buildAuthApp()
  })

  it('returns 200 with profile for valid token', async () => {
    const user = createUserFactory()
    mockVerifyIdToken.mockResolvedValue({
      uid: user.firebaseUid,
      email: user.email,
      role: 'user',
      tier: 'free',
    })
    mockSyncUser.mockResolvedValue(user)

    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/sync',
      headers: { authorization: 'Bearer valid-token' },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.success).toBe(true)
    expect(body.data.id).toBe(user.id)
  })

  it('returns 401 when no token', async () => {
    const response = await app.inject({ method: 'POST', url: '/v1/auth/sync' })
    expect(response.statusCode).toBe(401)
  })

  it('returns 401 when token is expired', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('Token expired'))

    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/sync',
      headers: { authorization: 'Bearer expired-token' },
    })
    expect(response.statusCode).toBe(401)
  })

  it('creates user when not in DB (upsert)', async () => {
    const user = createUserFactory()
    mockVerifyIdToken.mockResolvedValue({
      uid: user.firebaseUid,
      email: user.email,
      role: 'user',
      tier: 'free',
    })
    mockSyncUser.mockResolvedValue(user)

    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/sync',
      headers: { authorization: 'Bearer valid-token' },
    })
    expect(response.statusCode).toBe(200)
    expect(response.json().success).toBe(true)
  })

  it('ignores invalid displayName type and syncs without it', async () => {
    const user = createUserFactory()
    mockVerifyIdToken.mockResolvedValue({
      uid: user.firebaseUid,
      email: user.email,
      role: 'user',
      tier: 'free',
    })
    mockSyncUser.mockResolvedValue(user)

    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/sync',
      headers: { authorization: 'Bearer valid-token' },
      payload: { displayName: 123 },
    })

    expect(response.statusCode).toBe(200)
    // displayName should be undefined (invalid type ignored)
    expect(mockSyncUser).toHaveBeenCalledWith(
      expect.anything(),
      user.firebaseUid,
      user.email,
      expect.any(String),
      expect.anything(),
      undefined,
    )
  })

  it('returns 409 when syncUser throws email conflict', async () => {
    mockVerifyIdToken.mockResolvedValue({
      uid: 'uid',
      email: 'dup@test.com',
      role: 'user',
      tier: 'free',
    })
    mockSyncUser.mockRejectedValue(
      Object.assign(new Error('This email is already associated with another account'), {
        statusCode: 409,
      }),
    )

    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/sync',
      headers: { authorization: 'Bearer valid-token' },
    })

    expect(response.statusCode).toBe(409)
    expect(response.json().success).toBe(false)
  })

  it('passes displayName to syncUser when provided', async () => {
    const user = createUserFactory()
    mockVerifyIdToken.mockResolvedValue({
      uid: user.firebaseUid,
      email: user.email,
      role: 'user',
      tier: 'free',
    })
    mockSyncUser.mockResolvedValue(user)

    await app.inject({
      method: 'POST',
      url: '/v1/auth/sync',
      headers: { authorization: 'Bearer valid-token' },
      payload: { displayName: 'Alice' },
    })
    expect(mockSyncUser).toHaveBeenCalledWith(
      expect.anything(),
      user.firebaseUid,
      user.email,
      expect.any(String),
      expect.anything(),
      'Alice',
    )
  })
})
