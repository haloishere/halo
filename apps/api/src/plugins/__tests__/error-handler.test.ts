import { describe, it, expect, afterEach, vi } from 'vitest'
import Fastify from 'fastify'
import type { FastifyInstance } from 'fastify'
import { ZodError } from 'zod'
import errorHandler from '../error-handler.js'

// Mock Sentry (#17: verify Sentry.captureException is called on 5xx)
vi.mock('../../lib/sentry.js', () => ({
  Sentry: {
    captureException: vi.fn(),
  },
}))

import { Sentry } from '../../lib/sentry.js'

describe('error-handler plugin', () => {
  let app: FastifyInstance

  afterEach(async () => {
    if (app) await app.close()
    vi.clearAllMocks()
  })

  async function buildTestApp() {
    app = Fastify({ logger: false })
    await app.register(errorHandler)
    return app
  }

  it('returns 400 with structured details for ZodError', async () => {
    const testApp = await buildTestApp()
    testApp.get('/test-zod', async () => {
      throw new ZodError([
        {
          code: 'too_small',
          minimum: 1,
          type: 'string',
          inclusive: true,
          exact: false,
          message: 'String must contain at least 1 character(s)',
          path: ['name'],
        },
      ])
    })

    const response = await testApp.inject({ method: 'GET', url: '/test-zod' })
    expect(response.statusCode).toBe(400)
    const body = JSON.parse(response.body)
    expect(body.success).toBe(false)
    expect(body.error).toBe('Validation failed')
    expect(body.details).toEqual([
      { path: 'name', message: 'String must contain at least 1 character(s)' },
    ])
  })

  // #24: Nested ZodError paths are correctly joined with dots
  it('returns dot-joined path for nested ZodError fields', async () => {
    const testApp = await buildTestApp()
    testApp.get('/test-zod-nested', async () => {
      throw new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'number',
          message: 'Expected string, received number',
          path: ['user', 'address', 'city'],
        },
      ])
    })

    const response = await testApp.inject({ method: 'GET', url: '/test-zod-nested' })
    expect(response.statusCode).toBe(400)
    const body = JSON.parse(response.body)
    expect(body.details).toEqual([
      { path: 'user.address.city', message: 'Expected string, received number' },
    ])
  })

  it('returns 500 with generic message for internal errors', async () => {
    const testApp = await buildTestApp()
    testApp.get('/test-500', async () => {
      throw new Error('database connection lost')
    })

    const response = await testApp.inject({ method: 'GET', url: '/test-500' })
    expect(response.statusCode).toBe(500)
    const body = JSON.parse(response.body)
    expect(body.success).toBe(false)
    expect(body.error).toBe('Internal server error')
    // Must NOT leak internal details
    expect(response.body).not.toContain('database connection lost')
  })

  // #17: Sentry.captureException is called for 500 errors
  it('reports 500 errors to Sentry', async () => {
    const testApp = await buildTestApp()
    testApp.get('/test-sentry', async () => {
      throw new Error('unexpected failure')
    })

    await testApp.inject({ method: 'GET', url: '/test-sentry' })
    expect(Sentry.captureException).toHaveBeenCalledOnce()
    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'unexpected failure' }),
    )
  })

  // #17: Sentry should NOT be called for 4xx errors
  it('does NOT report 4xx errors to Sentry', async () => {
    const testApp = await buildTestApp()
    testApp.get('/test-no-sentry', async () => {
      const err = new Error('Not found') as Error & { statusCode: number }
      err.statusCode = 404
      throw err
    })

    await testApp.inject({ method: 'GET', url: '/test-no-sentry' })
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  // #18: Fix — this test now actually throws through the error handler
  it('passes through 4xx error messages from thrown errors', async () => {
    const testApp = await buildTestApp()
    testApp.get('/test-404', async () => {
      const err = new Error('Resource not found') as Error & { statusCode: number }
      err.statusCode = 404
      throw err
    })

    const response = await testApp.inject({ method: 'GET', url: '/test-404' })
    expect(response.statusCode).toBe(404)
    const body = JSON.parse(response.body)
    expect(body.success).toBe(false)
    expect(body.error).toBe('Resource not found')
  })

  it('handles Fastify errors with statusCode', async () => {
    const testApp = await buildTestApp()
    testApp.get('/test-bad-request', async () => {
      const err = new Error('Invalid input') as Error & { statusCode: number }
      err.statusCode = 400
      throw err
    })

    const response = await testApp.inject({ method: 'GET', url: '/test-bad-request' })
    expect(response.statusCode).toBe(400)
    const body = JSON.parse(response.body)
    expect(body.success).toBe(false)
    expect(body.error).toBe('Invalid input')
  })

  // #25: 4xx errors should not leak internal details
  it('sanitizes 4xx error messages that could leak internal details', async () => {
    const testApp = await buildTestApp()
    testApp.get('/test-leak', async () => {
      const err = new Error(
        'relation "users" does not exist at character 15',
      ) as Error & { statusCode: number }
      err.statusCode = 422
      throw err
    })

    const response = await testApp.inject({ method: 'GET', url: '/test-leak' })
    expect(response.statusCode).toBe(422)
    const body = JSON.parse(response.body)
    expect(body.success).toBe(false)
    // Should NOT contain internal database details
    expect(body.error).not.toContain('relation')
    expect(body.error).not.toContain('character 15')
  })
})
