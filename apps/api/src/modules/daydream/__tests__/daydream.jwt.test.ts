import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Hoisted mocks ────────────────────────────────────────────────────────────
// vi.mock is hoisted above imports, so these variables must be declared here.
const mockAccessSecretVersion = vi.fn()
const mockAddSecretVersion = vi.fn()

vi.mock('@google-cloud/secret-manager', () => ({
  SecretManagerServiceClient: vi.fn().mockImplementation(() => ({
    accessSecretVersion: mockAccessSecretVersion,
    addSecretVersion: mockAddSecretVersion,
  })),
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

process.env.DAYDREAM_JWT_SECRET_NAME = 'projects/test-proj/secrets/daydream-jwt'

// Import AFTER mocks are in place so the module picks up the mocked dep.
import {
  isExpiring,
  loadFromSecretManager,
  saveToSecretManager,
  refreshJwt,
  getJwt,
  forceRefreshJwt,
  _resetJwtCache,
} from '../daydream.jwt.js'

// ── Fixtures ─────────────────────────────────────────────────────────────────

const FRESH_JWT = {
  idToken: 'id-token-fresh',
  refreshToken: 'refresh-token',
  firebaseApiKey: 'api-key-xyz',
  expiresAt: Date.now() + 3_600_000, // 1 hour from now
  capturedAt: Date.now(),
}

const EXPIRING_JWT = {
  ...FRESH_JWT,
  idToken: 'id-token-expiring',
  expiresAt: Date.now() + 10_000, // 10 seconds — within the 60s skew
}

function smPayload(rec: typeof FRESH_JWT) {
  return [{ payload: { data: Buffer.from(JSON.stringify(rec)) } }]
}

function googleapisRefreshResponse(expiresIn = 3600) {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        id_token: 'id-token-refreshed',
        refresh_token: 'refresh-token-new',
        expires_in: String(expiresIn),
      }),
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  _resetJwtCache()
  mockAccessSecretVersion.mockReset()
  mockAddSecretVersion.mockReset()
  mockFetch.mockReset()
  mockAddSecretVersion.mockResolvedValue([{}])
})

describe('isExpiring', () => {
  it('returns false when token expires in an hour', () => {
    expect(isExpiring(FRESH_JWT)).toBe(false)
  })

  it('returns true when token expires within 60s (skew window)', () => {
    expect(isExpiring(EXPIRING_JWT)).toBe(true)
  })

  it('returns true when token is already expired', () => {
    expect(isExpiring({ ...FRESH_JWT, expiresAt: Date.now() - 1000 })).toBe(true)
  })
})

describe('loadFromSecretManager', () => {
  it('returns the parsed JwtRecord from the latest secret version', async () => {
    mockAccessSecretVersion.mockResolvedValueOnce(smPayload(FRESH_JWT))
    const rec = await loadFromSecretManager()
    expect(rec.idToken).toBe('id-token-fresh')
    expect(rec.firebaseApiKey).toBe('api-key-xyz')
    expect(mockAccessSecretVersion).toHaveBeenCalledWith({
      name: 'projects/test-proj/secrets/daydream-jwt/versions/latest',
    })
  })

  it('throws when the secret payload is missing', async () => {
    mockAccessSecretVersion.mockResolvedValueOnce([{ payload: {} }])
    await expect(loadFromSecretManager()).rejects.toThrow('Daydream JWT secret is empty')
  })
})

describe('saveToSecretManager', () => {
  it('adds a new secret version with the serialised JwtRecord', async () => {
    await saveToSecretManager(FRESH_JWT)
    expect(mockAddSecretVersion).toHaveBeenCalledWith({
      parent: 'projects/test-proj/secrets/daydream-jwt',
      payload: { data: Buffer.from(JSON.stringify(FRESH_JWT)) },
    })
  })
})

describe('refreshJwt', () => {
  it('exchanges the refresh token and returns a new JwtRecord', async () => {
    mockFetch.mockResolvedValueOnce(googleapisRefreshResponse())
    const result = await refreshJwt(EXPIRING_JWT)
    expect(result.idToken).toBe('id-token-refreshed')
    expect(result.refreshToken).toBe('refresh-token-new')
    expect(result.firebaseApiKey).toBe('api-key-xyz')
    expect(result.expiresAt).toBeGreaterThan(Date.now())
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('securetoken.googleapis.com'),
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('throws on a googleapis error response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: () => Promise.resolve('TOKEN_EXPIRED'),
    })
    await expect(refreshJwt(EXPIRING_JWT)).rejects.toThrow('JWT refresh failed: 400')
  })
})

describe('getJwt', () => {
  it('loads from Secret Manager when cache is empty', async () => {
    mockAccessSecretVersion.mockResolvedValueOnce(smPayload(FRESH_JWT))
    const rec = await getJwt()
    expect(rec.idToken).toBe('id-token-fresh')
    expect(mockAccessSecretVersion).toHaveBeenCalledOnce()
  })

  it('returns the cached value on subsequent calls (no SM hit)', async () => {
    mockAccessSecretVersion.mockResolvedValueOnce(smPayload(FRESH_JWT))
    await getJwt()
    await getJwt()
    expect(mockAccessSecretVersion).toHaveBeenCalledOnce()
  })

  it('refreshes and saves back when the cached token is expiring', async () => {
    mockAccessSecretVersion.mockResolvedValueOnce(smPayload(EXPIRING_JWT))
    mockFetch.mockResolvedValueOnce(googleapisRefreshResponse())
    const rec = await getJwt()
    expect(rec.idToken).toBe('id-token-refreshed')
    expect(mockAddSecretVersion).toHaveBeenCalledOnce()
  })
})

describe('forceRefreshJwt', () => {
  it('always loads from SM and refreshes even when cache is warm', async () => {
    // Warm the cache with a fresh token.
    mockAccessSecretVersion.mockResolvedValueOnce(smPayload(FRESH_JWT))
    await getJwt()

    // forceRefreshJwt should ignore the cache and refresh.
    mockAccessSecretVersion.mockResolvedValueOnce(smPayload(FRESH_JWT))
    mockFetch.mockResolvedValueOnce(googleapisRefreshResponse())
    const rec = await forceRefreshJwt()
    expect(rec.idToken).toBe('id-token-refreshed')
    expect(mockAddSecretVersion).toHaveBeenCalledOnce()
  })
})
