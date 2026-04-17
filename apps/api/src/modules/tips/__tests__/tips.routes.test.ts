import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { dailyTipSchema } from '@halo/shared'
import { mockFirebaseAuth } from '../../../test/mocks/index.js'

// Mock firebase
vi.mock('../../../lib/firebase-admin.js', () => ({
  firebaseAuth: mockFirebaseAuth,
}))

// Mock Sentry (used by error handler)
vi.mock('../../../lib/sentry.js', () => ({
  Sentry: { captureException: vi.fn() },
}))

// Mock the service function
const { mockGetRandomTip } = vi.hoisted(() => ({
  mockGetRandomTip: vi.fn(),
}))

vi.mock('../tips.service.js', () => ({
  getRandomTip: mockGetRandomTip,
}))

const { createTestApp } = await import('../../../test/helpers.js')
const tipsRoutes = (await import('../tips.routes.js')).default

let app: FastifyInstance

beforeEach(async () => {
  vi.clearAllMocks()

  mockFirebaseAuth.verifyIdToken.mockResolvedValue({
    uid: 'firebase-uid-123',
    email: 'test@example.com',
    role: 'user',
    tier: 'free',
  })

  app = await createTestApp()

  // Decorate with mock DB so verifyAuth + requireDbUser pass
  const mockDb = {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 'db-uuid-1', role: 'user', tier: 'free' }]),
        }),
      }),
    }),
  }
  app.decorate('db', mockDb)

  await app.register(tipsRoutes, { prefix: '/v1/tips' })
  await app.ready()
})

afterEach(async () => {
  await app.close()
})

describe('GET /v1/tips/daily', () => {
  it('returns 200 with { success: true, data: { tip, category } } for authenticated user', async () => {
    mockGetRandomTip.mockResolvedValue({
      tip: 'Take a short walk today.',
      category: 'Self Care',
    })

    const res = await app.inject({
      method: 'GET',
      url: '/v1/tips/daily',
      headers: { authorization: 'Bearer valid-token' },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(body.data.tip).toBe('Take a short walk today.')
    expect(body.data.category).toBe('Self Care')
  })

  it('returns 401 for unauthenticated request', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/tips/daily',
    })

    expect(res.statusCode).toBe(401)
    const body = res.json()
    expect(body.success).toBe(false)
  })

  it('response data matches dailyTipSchema shape', async () => {
    mockGetRandomTip.mockResolvedValue({
      tip: 'Stay hydrated throughout the day.',
      category: 'Daily Care',
    })

    const res = await app.inject({
      method: 'GET',
      url: '/v1/tips/daily',
      headers: { authorization: 'Bearer valid-token' },
    })

    const body = res.json()
    const parsed = dailyTipSchema.safeParse(body.data)
    expect(parsed.success).toBe(true)
  })

  it('handles service error gracefully', async () => {
    mockGetRandomTip.mockRejectedValue(new Error('Service failure'))

    const res = await app.inject({
      method: 'GET',
      url: '/v1/tips/daily',
      headers: { authorization: 'Bearer valid-token' },
    })

    // Global error handler converts 5xx to sanitized response
    expect(res.statusCode).toBe(500)
    const body = res.json()
    expect(body.success).toBe(false)
    // Should not leak internal error details
    expect(body.error).not.toContain('Service failure')
  })

  it('calls getRandomTip with the server db', async () => {
    mockGetRandomTip.mockResolvedValue({
      tip: 'A tip.',
      category: 'Safety',
    })

    await app.inject({
      method: 'GET',
      url: '/v1/tips/daily',
      headers: { authorization: 'Bearer valid-token' },
    })

    expect(mockGetRandomTip).toHaveBeenCalledTimes(1)
    // First argument should be the db object, second is the logger
    expect(mockGetRandomTip).toHaveBeenCalledWith(expect.any(Object), expect.any(Object))
  })
})
