import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createTestApp } from '../../test/helpers.js'
import { createUserFactory } from '../../test/factories/index.js'

// vi.hoisted ensures mocks are available when vi.mock factories run (before imports)
const { mockVerifyIdToken, mockGetProfile, mockUpdateOnboarding, mockWriteAuditLog } = vi.hoisted(
  () => ({
    mockVerifyIdToken: vi.fn(),
    mockGetProfile: vi.fn(),
    mockUpdateOnboarding: vi.fn(),
    mockWriteAuditLog: vi.fn(),
  }),
)

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

vi.mock('./users.service.js', () => ({
  getProfile: mockGetProfile,
  updateOnboarding: mockUpdateOnboarding,
}))

vi.mock('../../lib/audit.js', () => ({
  writeAuditLog: mockWriteAuditLog,
}))

const VALID_TOKEN_UID = 'test-uid-123'
const DB_USER_ID = 'db-user-uuid-123'

function makeMockDb() {
  // Minimal mock DB that satisfies verifyAuth's DB lookup (select → from → where → limit)
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

async function buildUsersApp() {
  const app = await createTestApp()
  const usersRoutes = (await import('./users.routes.js')).default
  app.decorate('db', makeMockDb() as never)
  await app.register(usersRoutes, { prefix: '/v1/users' })
  return app
}

function authHeader() {
  return { authorization: 'Bearer valid-token' }
}

beforeEach(async () => {
  vi.clearAllMocks()
  mockVerifyIdToken.mockResolvedValue({
    uid: VALID_TOKEN_UID,
    email: 'test@example.com',
    role: 'user',
    tier: 'free',
  })
  mockWriteAuditLog.mockResolvedValue(undefined)
})

describe('GET /v1/users/me', () => {
  it('returns 200 with user profile', async () => {
    const user = createUserFactory()
    mockGetProfile.mockResolvedValue(user)
    const app = await buildUsersApp()

    const response = await app.inject({ method: 'GET', url: '/v1/users/me', headers: authHeader() })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.success).toBe(true)
    expect(body.data.id).toBe(user.id)
  })

  it('returns 401 without token', async () => {
    const app = await buildUsersApp()
    const response = await app.inject({ method: 'GET', url: '/v1/users/me' })
    expect(response.statusCode).toBe(401)
  })

  it('returns 404 when user profile not found', async () => {
    mockGetProfile.mockResolvedValue(null)
    const app = await buildUsersApp()

    const response = await app.inject({ method: 'GET', url: '/v1/users/me', headers: authHeader() })
    expect(response.statusCode).toBe(404)
  })
})

describe('POST /v1/users/me/onboarding', () => {
  it('returns 200 with updated profile and onboardingCompleted set', async () => {
    const user = createUserFactory({ onboardingCompleted: new Date('2024-06-01') })
    mockUpdateOnboarding.mockResolvedValue(user)
    const app = await buildUsersApp()

    const response = await app.inject({
      method: 'POST',
      url: '/v1/users/me/onboarding',
      headers: authHeader(),
      payload: {
        city: 'Luzern',
      },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.data.onboardingCompleted).toBeDefined()
  })

  it('accepts displayName in payload and passes it to service', async () => {
    const user = createUserFactory({ onboardingCompleted: new Date('2024-06-01') })
    mockUpdateOnboarding.mockResolvedValue(user)
    const app = await buildUsersApp()

    const response = await app.inject({
      method: 'POST',
      url: '/v1/users/me/onboarding',
      headers: authHeader(),
      payload: {
        displayName: 'Alice',
        city: 'Luzern',
      },
    })

    expect(response.statusCode).toBe(200)
    expect(mockUpdateOnboarding).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      expect.objectContaining({ displayName: 'Alice' }),
    )
  })

  it('returns 400 when displayName exceeds max length', async () => {
    const app = await buildUsersApp()

    const response = await app.inject({
      method: 'POST',
      url: '/v1/users/me/onboarding',
      headers: authHeader(),
      payload: {
        displayName: 'a'.repeat(101),
        city: 'Luzern',
      },
    })

    expect(response.statusCode).toBe(400)
  })

  it('returns 400 when displayName is empty string', async () => {
    const app = await buildUsersApp()

    const response = await app.inject({
      method: 'POST',
      url: '/v1/users/me/onboarding',
      headers: authHeader(),
      payload: {
        displayName: '',
        city: 'Luzern',
      },
    })

    expect(response.statusCode).toBe(400)
  })

  it('returns 400 when displayName contains angle brackets', async () => {
    const app = await buildUsersApp()

    const response = await app.inject({
      method: 'POST',
      url: '/v1/users/me/onboarding',
      headers: authHeader(),
      payload: {
        displayName: '<script>',
        city: 'Luzern',
      },
    })

    expect(response.statusCode).toBe(400)
  })

  it("accepts displayName with apostrophe (e.g. O'Brien)", async () => {
    const user = createUserFactory({ onboardingCompleted: new Date('2024-06-01') })
    mockUpdateOnboarding.mockResolvedValue(user)
    const app = await buildUsersApp()

    const response = await app.inject({
      method: 'POST',
      url: '/v1/users/me/onboarding',
      headers: authHeader(),
      payload: {
        displayName: "O'Brien",
        city: 'Luzern',
      },
    })

    expect(response.statusCode).toBe(200)
    expect(mockUpdateOnboarding).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      expect.objectContaining({ displayName: "O'Brien" }),
    )
  })

  it('returns 400 when city exceeds max length', async () => {
    const app = await buildUsersApp()

    const response = await app.inject({
      method: 'POST',
      url: '/v1/users/me/onboarding',
      headers: authHeader(),
      payload: { city: 'a'.repeat(101) },
    })

    expect(response.statusCode).toBe(400)
  })

  it('writes audit log for onboarding completion (H7 fix)', async () => {
    const user = createUserFactory({ onboardingCompleted: new Date() })
    mockUpdateOnboarding.mockResolvedValue(user)
    const app = await buildUsersApp()

    await app.inject({
      method: 'POST',
      url: '/v1/users/me/onboarding',
      headers: authHeader(),
      payload: {
        city: 'Luzern',
      },
    })

    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'user.onboarding_complete', resource: 'user' }),
      expect.anything(),
    )
  })

  it('records submitted field names in audit metadata', async () => {
    const user = createUserFactory({ onboardingCompleted: new Date() })
    mockUpdateOnboarding.mockResolvedValue(user)
    const app = await buildUsersApp()

    await app.inject({
      method: 'POST',
      url: '/v1/users/me/onboarding',
      headers: authHeader(),
      payload: { displayName: 'Alice', age: 33, city: 'Luzern, Switzerland' },
    })

    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        metadata: { fields: expect.arrayContaining(['displayName', 'age', 'city']) },
      }),
      expect.anything(),
    )
  })

  it('accepts age in payload and passes it to service', async () => {
    const user = createUserFactory({ onboardingCompleted: new Date() })
    mockUpdateOnboarding.mockResolvedValue(user)
    const app = await buildUsersApp()

    const response = await app.inject({
      method: 'POST',
      url: '/v1/users/me/onboarding',
      headers: authHeader(),
      payload: { age: 42 },
    })

    expect(response.statusCode).toBe(200)
    expect(mockUpdateOnboarding).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      expect.objectContaining({ age: 42 }),
    )
  })

  it('returns 400 when age is below the GDPR floor', async () => {
    const app = await buildUsersApp()
    const response = await app.inject({
      method: 'POST',
      url: '/v1/users/me/onboarding',
      headers: authHeader(),
      payload: { age: 15 },
    })
    expect(response.statusCode).toBe(400)
  })

  it('returns 400 when age is not an integer', async () => {
    const app = await buildUsersApp()
    const response = await app.inject({
      method: 'POST',
      url: '/v1/users/me/onboarding',
      headers: authHeader(),
      payload: { age: 25.5 },
    })
    expect(response.statusCode).toBe(400)
  })
})
