import { describe, it, expect, afterEach, vi } from 'vitest'

// Mock firebase-admin to prevent initialization at module load time
// (app.ts now registers auth routes which import firebase-admin)
vi.mock('./lib/firebase-admin.js', () => ({
  firebaseAuth: {
    verifyIdToken: vi.fn(),
    setCustomUserClaims: vi.fn(),
    createUser: vi.fn(),
    getUser: vi.fn(),
    deleteUser: vi.fn(),
    updateUser: vi.fn(),
  },
}))
import { createTestApp } from './test/helpers.js'
import { buildApp } from './app.js'
import type { FastifyInstance } from 'fastify'

describe('buildApp', () => {
  let app: FastifyInstance

  afterEach(async () => {
    if (app) await app.close()
  })

  it('creates a Fastify instance', async () => {
    app = await createTestApp()
    expect(app).toBeDefined()
    expect(app.server).toBeDefined()
  })

  it('creates app with development logger transport', async () => {
    const originalEnv = process.env.NODE_ENV
    try {
      process.env.NODE_ENV = 'development'
      app = await buildApp({ skipDb: true })
      expect(app).toBeDefined()
    } finally {
      process.env.NODE_ENV = originalEnv
    }
  })

  it('creates app with production logger (no transport)', async () => {
    const originalEnv = process.env.NODE_ENV
    try {
      process.env.NODE_ENV = 'production'
      app = await buildApp({ skipDb: true })
      expect(app).toBeDefined()
    } finally {
      process.env.NODE_ENV = originalEnv
    }
  })

  it('responds to /healthz', async () => {
    app = await createTestApp()
    const response = await app.inject({
      method: 'GET',
      url: '/healthz',
    })
    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.status).toBe('ok')
    expect(body.timestamp).toBeUndefined()
  })

  it('responds to /livez', async () => {
    app = await createTestApp()
    const response = await app.inject({
      method: 'GET',
      url: '/livez',
    })
    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.status).toBe('ok')
  })

  it('generates request IDs', async () => {
    app = await createTestApp()
    const response = await app.inject({
      method: 'GET',
      url: '/healthz',
    })
    expect(response.headers['x-request-id']).toBeDefined()
  })

  it('returns 404 for unknown routes', async () => {
    app = await createTestApp()
    const response = await app.inject({
      method: 'GET',
      url: '/nonexistent',
    })
    expect(response.statusCode).toBe(404)
  })

  // trustProxy must use a specific hop count (not `true`) to prevent XFF spoofing
  it('resolves request.ip from rightmost XFF entry (1 trusted hop)', async () => {
    app = await buildApp({ skipDb: true, logger: false })

    // Register a test route that echoes request.ip
    app.get('/test-ip', async (request) => ({ ip: request.ip }))

    // GCP LB appends real client IP to XFF; LB's own IP is remoteAddress (not in XFF).
    // Attacker sends XFF: "1.2.3.4" → LB appends real IP → XFF: "1.2.3.4, 203.0.113.50"
    // inject()'s remoteAddress (127.0.0.1) simulates the LB connection.
    // With trustProxy: 1 → Fastify trusts 1 hop, picks last XFF entry (real client)
    // With trustProxy: true → Fastify picks first XFF entry (spoofed — WRONG)
    const response = await app.inject({
      method: 'GET',
      url: '/test-ip',
      headers: {
        'x-forwarded-for': '1.2.3.4, 203.0.113.50',
      },
    })

    const body = response.json()
    // Should be the real client IP (last XFF entry), NOT the spoofed one (first)
    expect(body.ip).toBe('203.0.113.50')
    expect(body.ip).not.toBe('1.2.3.4')
  })

  // #4: Health checks must not be rate-limited (Cloud Run probes)
  it('does not rate-limit /healthz', async () => {
    app = await buildApp({ skipDb: true, logger: false })
    // Send more requests than the rate limit (100/min)
    const requests = Array.from({ length: 105 }, () =>
      app.inject({ method: 'GET', url: '/healthz' }),
    )
    const responses = await Promise.all(requests)
    // All should succeed — none should be 429
    const rateLimited = responses.filter((r) => r.statusCode === 429)
    expect(rateLimited).toHaveLength(0)
  })

  // #4: Same for /livez
  it('does not rate-limit /livez', async () => {
    app = await buildApp({ skipDb: true, logger: false })
    const requests = Array.from({ length: 105 }, () => app.inject({ method: 'GET', url: '/livez' }))
    const responses = await Promise.all(requests)
    const rateLimited = responses.filter((r) => r.statusCode === 429)
    expect(rateLimited).toHaveLength(0)
  })
})
