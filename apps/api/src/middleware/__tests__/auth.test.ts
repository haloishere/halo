import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { mockFirebaseAuth } from '../../test/mocks/index.js'

vi.mock('../../lib/firebase-admin.js', () => ({
  firebaseAuth: mockFirebaseAuth,
}))

// Import after mock
const { verifyAuth, requireRole, requireDbUser } = await import('../auth.js')

function makeReply() {
  const reply = {
    code: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  }
  return reply as unknown as FastifyReply
}

function makeRequest(authHeader?: string, user?: object) {
  return {
    headers: { authorization: authHeader },
    user,
  } as unknown as FastifyRequest
}

describe('verifyAuth', () => {
  beforeEach(() => {
    mockFirebaseAuth.verifyIdToken.mockReset()
  })

  it('attaches user with correct shape for a valid token', async () => {
    mockFirebaseAuth.verifyIdToken.mockResolvedValue({
      uid: 'firebase-uid-123',
      email: 'test@example.com',
      role: 'user',
      tier: 'free',
    })

    const request = makeRequest('Bearer valid-token')
    const reply = makeReply()

    await verifyAuth(request, reply)

    expect(request.user).toEqual({
      uid: 'firebase-uid-123',
      email: 'test@example.com',
      role: 'user',
      tier: 'free',
    })
    expect(reply.code).not.toHaveBeenCalled()
  })

  it('returns 401 when Authorization header is missing', async () => {
    const request = makeRequest(undefined)
    const reply = makeReply()

    await verifyAuth(request, reply)

    expect(reply.code).toHaveBeenCalledWith(401)
    expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({ success: false }))
  })

  it('returns 401 for non-Bearer scheme', async () => {
    const request = makeRequest('Basic dXNlcjpwYXNz')
    const reply = makeReply()

    await verifyAuth(request, reply)

    expect(reply.code).toHaveBeenCalledWith(401)
  })

  it('returns 401 when token is expired', async () => {
    const error = Object.assign(new Error('Token expired'), { code: 'auth/id-token-expired' })
    mockFirebaseAuth.verifyIdToken.mockRejectedValue(error)

    const request = makeRequest('Bearer expired-token')
    const reply = makeReply()

    await verifyAuth(request, reply)

    expect(reply.code).toHaveBeenCalledWith(401)
  })

  it('returns 401 for malformed JWT', async () => {
    mockFirebaseAuth.verifyIdToken.mockRejectedValue(new Error('Decoding failed'))

    const request = makeRequest('Bearer not-a-jwt')
    const reply = makeReply()

    await verifyAuth(request, reply)

    expect(reply.code).toHaveBeenCalledWith(401)
  })

  it('re-throws non-auth errors as 500 instead of swallowing as 401', async () => {
    // Simulate Firebase Admin SDK init failure (e.g., ADC not available).
    // Init errors carry a 'code' that does NOT start with 'auth/' —
    // e.g., 'app/invalid-credential' from firebase-admin SDK.
    const initError = Object.assign(new Error('Failed to obtain Application Default Credentials'), {
      code: 'app/invalid-credential',
    })
    mockFirebaseAuth.verifyIdToken.mockRejectedValue(initError)

    const request = {
      headers: { authorization: 'Bearer valid-token' },
      log: { error: vi.fn() },
    } as unknown as FastifyRequest
    const reply = makeReply()

    await expect(verifyAuth(request, reply)).rejects.toThrow(
      'Failed to obtain Application Default Credentials',
    )
    expect(request.log.error).toHaveBeenCalled()
    expect(reply.code).not.toHaveBeenCalled()
  })

  it('returns 401 for Firebase auth errors with auth/ code prefix', async () => {
    const authError = Object.assign(new Error('Token revoked'), {
      code: 'auth/id-token-revoked',
    })
    mockFirebaseAuth.verifyIdToken.mockRejectedValue(authError)

    const request = makeRequest('Bearer revoked-token')
    const reply = makeReply()

    await verifyAuth(request, reply)

    expect(reply.code).toHaveBeenCalledWith(401)
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Invalid or expired token' }),
    )
  })

  it('returns 401 for wrong Firebase project (wrong aud)', async () => {
    const error = Object.assign(new Error('Firebase ID token has invalid audience'), {
      code: 'auth/argument-error',
    })
    mockFirebaseAuth.verifyIdToken.mockRejectedValue(error)

    const request = makeRequest('Bearer wrong-project-token')
    const reply = makeReply()

    await verifyAuth(request, reply)

    expect(reply.code).toHaveBeenCalledWith(401)
  })

  it('applies default role=user and tier=free when custom claims are missing', async () => {
    mockFirebaseAuth.verifyIdToken.mockResolvedValue({
      uid: 'uid-no-claims',
      email: 'noclaims@example.com',
      // no role or tier
    })

    const request = makeRequest('Bearer token-no-claims')
    const reply = makeReply()

    await verifyAuth(request, reply)

    expect(request.user.role).toBe('user')
    expect(request.user.tier).toBe('free')
  })

  it('falls back to safe defaults for invalid/malicious role and tier claims (C1 fix)', async () => {
    mockFirebaseAuth.verifyIdToken.mockResolvedValue({
      uid: 'uid-malicious',
      email: 'attacker@example.com',
      role: 'superadmin', // not in USER_ROLES
      tier: 'enterprise', // not in USER_TIERS
    })

    const request = makeRequest('Bearer malicious-token')
    const reply = makeReply()

    await verifyAuth(request, reply)

    expect(request.user.role).toBe('user')
    expect(request.user.tier).toBe('free')
  })

  it('parses custom claims when present', async () => {
    mockFirebaseAuth.verifyIdToken.mockResolvedValue({
      uid: 'admin-uid',
      email: 'admin@example.com',
      role: 'admin',
      tier: 'premium',
    })

    const request = makeRequest('Bearer admin-token')
    const reply = makeReply()

    await verifyAuth(request, reply)

    expect(request.user.role).toBe('admin')
    expect(request.user.tier).toBe('premium')
  })

  it('syncs role and tier from DB when DB user is found (H3 fix)', async () => {
    mockFirebaseAuth.verifyIdToken.mockResolvedValue({
      uid: 'uid-stale-claims',
      email: 'stale@example.com',
      role: 'user', // Stale claim
      tier: 'free', // Stale claim
    })

    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 'db-uuid-1', role: 'admin', tier: 'premium' }]),
          }),
        }),
      }),
    }

    const request = {
      headers: { authorization: 'Bearer valid-token' },
      server: { hasDecorator: vi.fn().mockReturnValue(true), db: mockDb },
      log: { warn: vi.fn() },
    } as unknown as FastifyRequest
    const reply = makeReply()

    await verifyAuth(request, reply)

    expect(request.user.dbUserId).toBe('db-uuid-1')
    expect(request.user.role).toBe('admin')
    expect(request.user.tier).toBe('premium')
  })

  it('logs warning when DB lookup fails (H2 fix)', async () => {
    mockFirebaseAuth.verifyIdToken.mockResolvedValue({
      uid: 'uid-db-fail',
      email: 'dbfail@example.com',
    })

    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockRejectedValue(new Error('Connection refused')),
          }),
        }),
      }),
    }

    const warnFn = vi.fn()
    const request = {
      headers: { authorization: 'Bearer valid-token' },
      server: { hasDecorator: vi.fn().mockReturnValue(true), db: mockDb },
      log: { warn: warnFn },
    } as unknown as FastifyRequest
    const reply = makeReply()

    await verifyAuth(request, reply)

    expect(warnFn).toHaveBeenCalledWith(
      expect.objectContaining({ uid: 'uid-db-fail' }),
      expect.stringContaining('DB user lookup failed'),
    )
  })
})

describe('requireDbUser', () => {
  it('returns 401 when dbUserId is not set', async () => {
    const request = makeRequest(undefined, {
      uid: 'firebase-uid',
      email: 'test@example.com',
      role: 'user',
      tier: 'free',
      // no dbUserId
    })
    const reply = makeReply()

    await requireDbUser(request, reply)

    expect(reply.code).toHaveBeenCalledWith(401)
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('not found') }),
    )
  })

  it('passes when dbUserId is present', async () => {
    const request = makeRequest(undefined, {
      uid: 'firebase-uid',
      email: 'test@example.com',
      role: 'user',
      tier: 'free',
      dbUserId: 'db-uuid-123',
    })
    const reply = makeReply()

    await requireDbUser(request, reply)

    expect(reply.code).not.toHaveBeenCalled()
  })
})

describe('requireRole', () => {
  it('returns 403 when user role is not in allowed roles', async () => {
    const request = makeRequest(undefined, {
      uid: 'u1',
      email: 'u@e.com',
      role: 'user',
      tier: 'free',
    })
    const reply = makeReply()

    await requireRole('admin')(request, reply)

    expect(reply.code).toHaveBeenCalledWith(403)
  })

  it('passes when user has a matching role', async () => {
    const request = makeRequest(undefined, {
      uid: 'a1',
      email: 'a@e.com',
      role: 'admin',
      tier: 'free',
    })
    const reply = makeReply()

    await requireRole('admin')(request, reply)

    expect(reply.code).not.toHaveBeenCalled()
  })

  it('passes when user role matches one of multiple allowed roles', async () => {
    const request = makeRequest(undefined, {
      uid: 'm1',
      email: 'm@e.com',
      role: 'moderator',
      tier: 'free',
    })
    const reply = makeReply()

    await requireRole('admin', 'moderator')(request, reply)

    expect(reply.code).not.toHaveBeenCalled()
  })
})
