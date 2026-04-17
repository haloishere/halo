import crypto from 'node:crypto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockFirebaseAuth } from '../../test/mocks/index.js'
import { createUserFactory } from '../../test/factories/index.js'

vi.mock('../../lib/firebase-admin.js', () => ({
  firebaseAuth: mockFirebaseAuth,
}))

vi.mock('../../lib/audit.js', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../lib/email.js', () => ({
  sendOtpEmail: vi.fn().mockResolvedValue(undefined),
}))

const { generateOtp, hashCode, createOtp, verifyOtp, cleanupExpiredOtps } =
  await import('./otp.service.js')
const { sendOtpEmail } = await import('../../lib/email.js')
const { writeAuditLog } = await import('../../lib/audit.js')

// --- DB mock helpers ---

function makeOtpRow(overrides: Record<string, unknown> = {}) {
  return {
    id: crypto.randomUUID(),
    email: 'test@example.com',
    codeHash: hashCode('123456'),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min from now
    attempts: 0,
    usedAt: null,
    createdAt: new Date(),
    ...overrides,
  }
}

function makeUpdateMock(returnValue: unknown[] = [makeOtpRow()]) {
  return vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue(returnValue),
      }),
    }),
  })
}

function makeDb(overrides: Record<string, unknown> = {}) {
  const defaultUser = createUserFactory()
  const defaultUpdate = makeUpdateMock()
  const defaultInsert = vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({
      onConflictDoUpdate: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([defaultUser]),
      }),
      returning: vi.fn().mockResolvedValue([makeOtpRow()]),
    }),
  })

  // Transaction mock: passes the same db interface to the callback
  const txDb = {
    update: defaultUpdate,
    insert: defaultInsert,
  }
  const transaction = vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
    await fn(txDb)
  })

  return {
    update: defaultUpdate,
    insert: defaultInsert,
    transaction,
    // select() is used by createOtp (count queries) and verifyOtp (lockout + row lookup).
    // Default mock: each where() call returns count=0/totalAttempts=0 (as thenable),
    // with orderBy/limit chaining for verifyOtp's code lookup path.
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation((..._args: unknown[]) => {
          const result = Promise.resolve([{ count: 0, totalAttempts: 0 }])
          return Object.assign(result, {
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([makeOtpRow()]),
            }),
            limit: vi.fn().mockResolvedValue([defaultUser]),
          })
        }),
      }),
    }),
    ...overrides,
  } as unknown as Parameters<typeof createOtp>[0]
}

/**
 * Build a select mock for verifyOtp: first call returns lockout SUM(attempts),
 * second call returns the OTP row lookup chain (orderBy→limit) + user lookup (limit).
 */
function makeVerifySelectMock(
  otpRow: ReturnType<typeof makeOtpRow> | null,
  user?: unknown,
  lockoutTotal = 0,
) {
  const whereMock = vi.fn()
  // First call: lockout aggregate → [{ totalAttempts }]
  whereMock.mockImplementationOnce(() => Promise.resolve([{ totalAttempts: lockoutTotal }]))
  // Second call: OTP row lookup with orderBy/limit chaining
  whereMock.mockImplementationOnce(() => {
    const result = Promise.resolve([])
    return Object.assign(result, {
      orderBy: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(otpRow ? [otpRow] : []),
      }),
      limit: vi.fn().mockResolvedValue(user ? [user] : []),
    })
  })
  // Subsequent calls (findOrCreateDbUser): return user
  whereMock.mockImplementation(() => {
    const result = Promise.resolve([])
    return Object.assign(result, {
      orderBy: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([]),
      }),
      limit: vi.fn().mockResolvedValue(user ? [user] : []),
    })
  })
  return vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({ where: whereMock }),
  })
}

// --- Tests ---

describe('generateOtp', () => {
  it('returns a 6-digit string', () => {
    const code = generateOtp()
    expect(code).toMatch(/^\d{6}$/)
    expect(code.length).toBe(6)
  })

  it('returns different codes on subsequent calls (probabilistic)', () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateOtp()))
    // With 1M possible codes, 20 draws should have at least 2 unique values
    expect(codes.size).toBeGreaterThan(1)
  })
})

describe('hashCode', () => {
  it('returns a SHA-256 hex digest', () => {
    const hash = hashCode('123456')
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('returns consistent hash for same input', () => {
    expect(hashCode('123456')).toBe(hashCode('123456'))
  })

  it('returns different hash for different input', () => {
    expect(hashCode('123456')).not.toBe(hashCode('654321'))
  })
})

describe('createOtp', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('invalidates existing codes, inserts new code, and sends email', async () => {
    const db = makeDb()
    await createOtp(db, 'test@example.com')

    // Should use a transaction for atomic invalidation + insert
    expect(db.transaction).toHaveBeenCalled()
    // Should send email
    expect(sendOtpEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'test@example.com',
        code: expect.stringMatching(/^\d{6}$/),
      }),
    )
  })

  it('throws when too many active codes exist for the same email', async () => {
    // Simulate 3 active (unexpired, unused) codes already in DB
    const db = makeDb({
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 3 }]),
        }),
      }),
    })

    await expect(createOtp(db, 'spam@example.com')).rejects.toThrow('Too many codes requested')

    // Should NOT send email or start transaction
    expect(sendOtpEmail).not.toHaveBeenCalled()
    expect(db.transaction).not.toHaveBeenCalled()
  })

  it('allows createOtp when fewer than 3 active codes exist', async () => {
    // Simulate 2 active codes — under the limit
    const db = makeDb({
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 2 }]),
        }),
      }),
    })

    await createOtp(db, 'ok@example.com')

    expect(db.transaction).toHaveBeenCalled()
    expect(sendOtpEmail).toHaveBeenCalled()
  })

  it('rejects send when 5 codes sent within the hour even if all are expired', async () => {
    // Hourly count returns 5 (at limit), active count returns 0 (all expired)
    const selectMock = vi.fn()
    const fromMock = vi.fn()
    const whereMock = vi.fn()
    // First call = hourly count → 5 (at limit)
    whereMock.mockResolvedValueOnce([{ count: 5 }])
    // Second call = active count → 0
    whereMock.mockResolvedValueOnce([{ count: 0 }])
    fromMock.mockReturnValue({ where: whereMock })
    selectMock.mockReturnValue({ from: fromMock })

    const db = makeDb({ select: selectMock })

    await expect(createOtp(db, 'spam@example.com')).rejects.toThrow('Too many codes requested')

    expect(sendOtpEmail).not.toHaveBeenCalled()
    expect(db.transaction).not.toHaveBeenCalled()
  })

  it('allows send when hourly count is below limit', async () => {
    // Hourly count returns 4 (below limit), active count returns 0
    const selectMock = vi.fn()
    const fromMock = vi.fn()
    const whereMock = vi.fn()
    // First call = hourly count → 4 (below limit)
    whereMock.mockResolvedValueOnce([{ count: 4 }])
    // Second call = active count → 0
    whereMock.mockResolvedValueOnce([{ count: 0 }])
    fromMock.mockReturnValue({ where: whereMock })
    selectMock.mockReturnValue({ from: fromMock })

    const db = makeDb({ select: selectMock })

    await createOtp(db, 'ok@example.com')

    expect(db.transaction).toHaveBeenCalled()
    expect(sendOtpEmail).toHaveBeenCalled()
  })

  it('writes audit log with action otp.send', async () => {
    const db = makeDb()
    await createOtp(db, 'audit@example.com', '10.0.0.1')

    expect(writeAuditLog).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        action: 'otp.send',
        resource: 'otp',
        ipAddress: '10.0.0.1',
      }),
    )
  })
})

describe('verifyOtp', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFirebaseAuth.getUserByEmail.mockRejectedValue(
      Object.assign(new Error('not found'), { code: 'auth/user-not-found' }),
    )
    mockFirebaseAuth.createUser.mockResolvedValue({ uid: 'new-firebase-uid' })
    mockFirebaseAuth.createCustomToken.mockResolvedValue('mock-custom-token')
    mockFirebaseAuth.setCustomUserClaims.mockResolvedValue(undefined)
  })

  it('returns customToken and user on valid code', async () => {
    const otpRow = makeOtpRow({ codeHash: hashCode('123456') })
    const user = createUserFactory({ email: 'test@example.com' })

    const db = makeDb({
      select: makeVerifySelectMock(otpRow, user),
      update: makeUpdateMock([otpRow]),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([user]),
          }),
        }),
      }),
    })

    const result = await verifyOtp(db, 'test@example.com', '123456')

    expect(result.customToken).toBe('mock-custom-token')
    expect(result.user).toBeDefined()
  })

  it('returns error for expired code (DB filters out expired rows)', async () => {
    // The SQL query filters out expired codes via gt(expiresAt, now()),
    // so expired codes are never returned — we simulate with empty result.
    const db = makeDb({
      select: makeVerifySelectMock(null),
    })

    await expect(verifyOtp(db, 'test@example.com', '123456')).rejects.toThrow(
      'Code expired or not found',
    )
  })

  it('returns error when no code exists', async () => {
    const db = makeDb({
      select: makeVerifySelectMock(null),
    })

    await expect(verifyOtp(db, 'test@example.com', '123456')).rejects.toThrow(
      'Code expired or not found',
    )
  })

  it('returns error after 5 failed attempts on single code (per-code lockout)', async () => {
    const lockedRow = makeOtpRow({
      codeHash: hashCode('123456'),
      attempts: 5,
    })

    const db = makeDb({
      select: makeVerifySelectMock(lockedRow),
    })

    await expect(verifyOtp(db, 'test@example.com', '123456')).rejects.toThrow('Too many attempts')
  })

  it('returns error for already-used code (DB filters out used rows)', async () => {
    // The SQL query filters out used codes via isNull(usedAt),
    // so used codes are never returned — we simulate with empty result.
    const db = makeDb({
      select: makeVerifySelectMock(null),
    })

    await expect(verifyOtp(db, 'test@example.com', '123456')).rejects.toThrow(
      'Code expired or not found',
    )
  })

  it('increments attempts on wrong code', async () => {
    const otpRow = makeOtpRow({ codeHash: hashCode('999999') }) // different code
    const mockUpdate = makeUpdateMock([])

    const db = makeDb({
      select: makeVerifySelectMock(otpRow),
      update: mockUpdate,
    })

    await expect(verifyOtp(db, 'test@example.com', '123456')).rejects.toThrow('Invalid code')
    expect(mockUpdate).toHaveBeenCalled()
  })

  it('creates new Firebase user if not found by email', async () => {
    const otpRow = makeOtpRow({ codeHash: hashCode('123456') })
    const user = createUserFactory()

    mockFirebaseAuth.getUserByEmail.mockRejectedValue(
      Object.assign(new Error('not found'), { code: 'auth/user-not-found' }),
    )
    mockFirebaseAuth.createUser.mockResolvedValue({ uid: 'new-uid' })

    const db = makeDb({
      select: makeVerifySelectMock(otpRow, user),
      update: makeUpdateMock([otpRow]),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([user]),
          }),
        }),
      }),
    })

    await verifyOtp(db, 'test@example.com', '123456')

    expect(mockFirebaseAuth.createUser).toHaveBeenCalledWith({
      email: 'test@example.com',
      emailVerified: true,
    })
  })

  it('uses existing Firebase user if found by email', async () => {
    const otpRow = makeOtpRow({ codeHash: hashCode('123456') })
    const user = createUserFactory()

    mockFirebaseAuth.getUserByEmail.mockResolvedValue({ uid: 'existing-uid' })

    const db = makeDb({
      select: makeVerifySelectMock(otpRow, user),
      update: makeUpdateMock([otpRow]),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([user]),
          }),
        }),
      }),
    })

    await verifyOtp(db, 'test@example.com', '123456')

    expect(mockFirebaseAuth.createUser).not.toHaveBeenCalled()
    expect(mockFirebaseAuth.createCustomToken).toHaveBeenCalledWith('existing-uid')
  })

  it('writes audit log on successful verification', async () => {
    const otpRow = makeOtpRow({ codeHash: hashCode('123456') })
    const user = createUserFactory()

    mockFirebaseAuth.getUserByEmail.mockResolvedValue({ uid: 'uid-1' })

    const db = makeDb({
      select: makeVerifySelectMock(otpRow, user),
      update: makeUpdateMock([otpRow]),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([user]),
          }),
        }),
      }),
    })

    await verifyOtp(db, 'test@example.com', '123456', '10.0.0.1')

    expect(writeAuditLog).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        action: 'otp.verify.success',
        resource: 'otp',
        ipAddress: '10.0.0.1',
      }),
    )
  })

  it('throws 401 on TOCTOU race (concurrent code consumption)', async () => {
    const otpRow = makeOtpRow({ codeHash: hashCode('123456') })

    // update().returning() returns empty array = code was consumed by another request
    const emptyUpdate = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    })

    const db = makeDb({
      select: makeVerifySelectMock(otpRow),
      update: emptyUpdate,
    })

    await expect(verifyOtp(db, 'test@example.com', '123456')).rejects.toThrow(
      'Code expired or not found',
    )
  })

  it('re-throws non-user-not-found Firebase errors', async () => {
    const otpRow = makeOtpRow({ codeHash: hashCode('123456') })

    mockFirebaseAuth.getUserByEmail.mockRejectedValue(
      Object.assign(new Error('Firebase internal error'), { code: 'auth/internal-error' }),
    )

    const db = makeDb({
      select: makeVerifySelectMock(otpRow),
      update: makeUpdateMock([otpRow]),
    })

    await expect(verifyOtp(db, 'test@example.com', '123456')).rejects.toThrow(
      'Firebase internal error',
    )
  })

  it('throws when upsert returns empty (findOrCreateDbUser failure)', async () => {
    const otpRow = makeOtpRow({ codeHash: hashCode('123456') })

    mockFirebaseAuth.getUserByEmail.mockResolvedValue({ uid: 'uid-1' })

    const db = makeDb({
      select: makeVerifySelectMock(otpRow, null),
      update: makeUpdateMock([otpRow]),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]), // upsert returns empty
          }),
        }),
      }),
    })

    await expect(verifyOtp(db, 'test@example.com', '123456')).rejects.toThrow(
      'Failed to create or retrieve user after upsert',
    )
  })

  it('logs error when setCustomUserClaims fails', async () => {
    const otpRow = makeOtpRow({ codeHash: hashCode('123456') })
    const user = createUserFactory()

    mockFirebaseAuth.getUserByEmail.mockResolvedValue({ uid: 'uid-1' })
    mockFirebaseAuth.setCustomUserClaims.mockRejectedValue(new Error('Claims failed'))

    const mockLogger = { warn: vi.fn(), error: vi.fn() }

    const db = makeDb({
      select: makeVerifySelectMock(otpRow, user),
      update: makeUpdateMock([otpRow]),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([user]),
          }),
        }),
      }),
    })

    // Should NOT throw — claims failure is non-critical
    const result = await verifyOtp(
      db,
      'test@example.com',
      '123456',
      '10.0.0.1',
      undefined,
      mockLogger as never,
    )
    expect(result.customToken).toBeDefined()
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ firebaseUid: 'uid-1', userId: user.id }),
      'Failed to set custom user claims',
    )
  })

  it('writes audit log on failed verification', async () => {
    const otpRow = makeOtpRow({ codeHash: hashCode('999999') })

    const db = makeDb({
      select: makeVerifySelectMock(otpRow),
    })

    await expect(verifyOtp(db, 'test@example.com', '123456', '10.0.0.1')).rejects.toThrow(
      'Invalid code',
    )

    expect(writeAuditLog).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        action: 'otp.verify.fail',
        resource: 'otp',
      }),
    )
  })

  it('locks out email after 10 total failed attempts across codes within 30 minutes', async () => {
    const otpRow = makeOtpRow({ codeHash: hashCode('123456') })

    const db = makeDb({
      select: makeVerifySelectMock(otpRow, undefined, 10),
    })

    await expect(verifyOtp(db, 'test@example.com', '123456')).rejects.toThrow(
      'Too many attempts. Request a new code.',
    )
  })

  it('allows verification after lockout window expires (totalAttempts below threshold)', async () => {
    const otpRow = makeOtpRow({ codeHash: hashCode('123456') })
    const user = createUserFactory()

    // totalAttempts = 9 (just below 10 threshold)
    const db = makeDb({
      select: makeVerifySelectMock(otpRow, user, 9),
      update: makeUpdateMock([otpRow]),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([user]),
          }),
        }),
      }),
    })

    const result = await verifyOtp(db, 'test@example.com', '123456')
    expect(result.customToken).toBe('mock-custom-token')
  })

  it('writes audit log on per-email lockout', async () => {
    const otpRow = makeOtpRow({ codeHash: hashCode('123456') })

    const db = makeDb({
      select: makeVerifySelectMock(otpRow, undefined, 10),
    })

    await expect(verifyOtp(db, 'test@example.com', '123456', '10.0.0.1')).rejects.toThrow(
      'Too many attempts',
    )

    expect(writeAuditLog).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        action: 'otp.verify.lockout',
        resource: 'otp',
      }),
    )
  })
})

describe('cleanupExpiredOtps', () => {
  it('deletes OTP codes older than retention period and returns count', async () => {
    const mockDelete = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: '1' }, { id: '2' }]),
      }),
    })
    const db = makeDb({ delete: mockDelete })

    const deleted = await cleanupExpiredOtps(db)

    expect(mockDelete).toHaveBeenCalled()
    expect(deleted).toBe(2)
  })

  it('returns 0 when no rows to delete', async () => {
    const mockDelete = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    })
    const db = makeDb({ delete: mockDelete })

    const deleted = await cleanupExpiredOtps(db)

    expect(deleted).toBe(0)
  })
})
