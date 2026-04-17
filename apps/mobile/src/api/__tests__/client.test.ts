import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockAuth = vi.hoisted(() => ({
  currentUser: null as { getIdToken: () => Promise<string> } | null,
}))

vi.mock('../../lib/firebase', () => ({ auth: mockAuth }))

import { apiRequest, assertHttpsInProduction } from '../client'

const mockFetch = vi.fn()
global.fetch = mockFetch

beforeEach(() => {
  mockFetch.mockReset()
  mockAuth.currentUser = null
})

function makeJsonResponse(body: unknown, status = 200) {
  return {
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response
}

describe('apiRequest — auth header', () => {
  it('omits Authorization when no current user', async () => {
    mockFetch.mockResolvedValueOnce(makeJsonResponse({ success: true, data: 'ok' }))
    await apiRequest('/v1/test')
    const headers = mockFetch.mock.calls[0][1].headers as Record<string, string>
    expect(headers['Authorization']).toBeUndefined()
  })

  it('injects Bearer token when currentUser exists', async () => {
    mockAuth.currentUser = { getIdToken: vi.fn().mockResolvedValue('my-token') }
    mockFetch.mockResolvedValueOnce(makeJsonResponse({ success: true }))
    await apiRequest('/v1/test')
    const headers = mockFetch.mock.calls[0][1].headers as Record<string, string>
    expect(headers['Authorization']).toBe('Bearer my-token')
  })
})

describe('apiRequest — x-request-id header', () => {
  it('sends an x-request-id header', async () => {
    mockFetch.mockResolvedValueOnce(makeJsonResponse({ success: true }))
    await apiRequest('/v1/test')
    const headers = mockFetch.mock.calls[0][1].headers as Record<string, string>
    expect(headers['x-request-id']).toBeDefined()
    expect(typeof headers['x-request-id']).toBe('string')
    expect(headers['x-request-id'].length).toBeGreaterThan(0)
  })

  it('generates a fallback request ID when crypto.randomUUID is unavailable', async () => {
    const originalRandomUUID = crypto.randomUUID
    // Simulate Hermes environment
    Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true })
    try {
      mockFetch.mockResolvedValueOnce(makeJsonResponse({ success: true }))
      await apiRequest('/v1/test')
      const headers = mockFetch.mock.calls[0][1].headers as Record<string, string>
      expect(headers['x-request-id']).toBeDefined()
      expect(headers['x-request-id']).toMatch(/^h-[a-z0-9]+-[a-z0-9]+$/)
    } finally {
      Object.defineProperty(crypto, 'randomUUID', {
        value: originalRandomUUID,
        configurable: true,
      })
    }
  })
})

describe('apiRequest — Content-Type header', () => {
  it('sets Content-Type application/json when body is present', async () => {
    mockFetch.mockResolvedValueOnce(makeJsonResponse({ success: true }))
    await apiRequest('/v1/test', { method: 'POST', body: JSON.stringify({ foo: 1 }) })
    const headers = mockFetch.mock.calls[0][1].headers as Record<string, string>
    expect(headers['Content-Type']).toBe('application/json')
  })

  it('omits Content-Type when no body is provided', async () => {
    mockFetch.mockResolvedValueOnce(makeJsonResponse({ success: true }))
    await apiRequest('/v1/test', { method: 'DELETE' })
    const headers = mockFetch.mock.calls[0][1].headers as Record<string, string>
    expect(headers['Content-Type']).toBeUndefined()
  })
})

describe('apiRequest — network error', () => {
  it('returns success:false on fetch throw', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network failure'))
    const result = await apiRequest('/v1/test')
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('Network error')
  })
})

describe('apiRequest — 204 No Content', () => {
  it('returns success:true without parsing JSON', async () => {
    mockFetch.mockResolvedValueOnce({ status: 204 } as Response)
    const result = await apiRequest('/v1/test')
    expect(result.success).toBe(true)
  })
})

describe('apiRequest — JSON parse error', () => {
  it('returns success:false when body is not valid JSON', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 503,
      json: vi.fn().mockRejectedValue(new SyntaxError('Unexpected token')),
    } as unknown as Response)
    const result = await apiRequest('/v1/test')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('Server error')
      expect(result.error).toContain('503')
    }
  })
})

describe('assertHttpsInProduction', () => {
  it('throws when non-dev build uses http://', () => {
    expect(() => assertHttpsInProduction('http://api.halo.app', false)).toThrow('HTTPS required')
  })

  it('allows https:// in non-dev build', () => {
    expect(() => assertHttpsInProduction('https://api.halo.app', false)).not.toThrow()
  })

  it('allows http:// in dev build', () => {
    expect(() => assertHttpsInProduction('http://localhost:3000', true)).not.toThrow()
  })
})

describe('apiRequest — happy path', () => {
  it('returns parsed JSON response', async () => {
    const payload = { success: true, data: { id: '1', name: 'test' } }
    mockFetch.mockResolvedValueOnce(makeJsonResponse(payload))
    const result = await apiRequest<{ id: string; name: string }>('/v1/test')
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toEqual({ id: '1', name: 'test' })
  })
})
