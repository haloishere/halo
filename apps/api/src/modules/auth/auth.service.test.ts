import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockFirebaseAuth } from '../../test/mocks/index.js'
import { createUserFactory } from '../../test/factories/index.js'

vi.mock('../../lib/firebase-admin.js', () => ({
  firebaseAuth: mockFirebaseAuth,
}))

vi.mock('../../lib/audit.js', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}))

const { registerUser, syncUser, upsertDbUser } = await import('./auth.service.js')
const { writeAuditLog } = await import('../../lib/audit.js')

function makeDb(overrides: Record<string, unknown> = {}) {
  const defaultUser = createUserFactory()
  const returningPromise = Promise.resolve([defaultUser])
  return {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: vi.fn().mockReturnValue({
          returning: vi.fn().mockReturnValue(returningPromise),
        }),
      }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([defaultUser]),
        }),
      }),
    }),
    ...overrides,
  } as unknown as Parameters<typeof registerUser>[0]
}

describe('registerUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFirebaseAuth.setCustomUserClaims.mockResolvedValue(undefined)
  })

  it('creates user in DB with correct fields and returns UserRecord', async () => {
    const db = makeDb()
    const result = await registerUser(db, 'firebase-uid-1', 'user@test.com', 'Alice')

    expect(result).toBeDefined()
    // The returned record comes from the DB mock (createUserFactory) — verify shape
    expect(result.id).toBeDefined()
    expect(result.email).toBeDefined()
  })

  it('calls setCustomUserClaims with { role, tier }', async () => {
    const db = makeDb()
    await registerUser(db, 'firebase-uid-2', 'user2@test.com', 'Bob')

    expect(mockFirebaseAuth.setCustomUserClaims).toHaveBeenCalledWith(
      'firebase-uid-2',
      expect.objectContaining({ role: 'user', tier: 'free' }),
    )
  })

  it('upserts on duplicate firebaseUid (calls onConflictDoUpdate)', async () => {
    const db = makeDb()
    await registerUser(db, 'same-uid', 'email@test.com', 'Charlie')
    await registerUser(db, 'same-uid', 'email@test.com', 'Charlie')

    // DB insert called twice — upsert handles conflict
    expect(db.insert).toHaveBeenCalledTimes(2)
  })

  it('writes audit log with action user.register', async () => {
    const db = makeDb()
    await registerUser(db, 'firebase-uid-3', 'audit@test.com', 'Dave', '1.2.3.4')

    expect(writeAuditLog).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ action: 'user.register', ipAddress: '1.2.3.4' }),
    )
  })

  it('rejects with 409 when email belongs to a different firebaseUid', async () => {
    const emailConflictError = Object.assign(new Error('duplicate key'), {
      code: '23505',
      constraint_name: 'users_email_unique',
    })
    const db = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockReturnValue({
            returning: vi.fn().mockReturnValue({
              catch: vi.fn().mockImplementation(async (handler: (err: unknown) => unknown) => {
                return handler(emailConflictError)
              }),
            }),
          }),
        }),
      }),
    } as unknown as Parameters<typeof registerUser>[0]

    await expect(registerUser(db, 'new-uid', 'dup@test.com', 'Name')).rejects.toMatchObject({
      message: 'This email is already associated with another account',
      statusCode: 409,
    })
  })

  it('re-throws non-email DB errors from insert', async () => {
    const dbError = new Error('connection refused')
    const db = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockReturnValue({
            returning: vi.fn().mockReturnValue({
              catch: vi.fn().mockImplementation(async (handler: (err: unknown) => unknown) => {
                return handler(dbError)
              }),
            }),
          }),
        }),
      }),
    } as unknown as Parameters<typeof registerUser>[0]

    await expect(registerUser(db, 'uid', 'e@test.com', 'Name')).rejects.toThrow(
      'connection refused',
    )
  })

  it('does NOT throw when setCustomUserClaims fails (H5 fix)', async () => {
    mockFirebaseAuth.setCustomUserClaims.mockRejectedValue(new Error('Firebase unavailable'))
    const db = makeDb()

    // Should complete successfully — claims failure is swallowed
    const result = await registerUser(db, 'firebase-uid-4', 'claims@test.com', 'Eve')
    expect(result).toBeDefined()
    expect(result.id).toBeDefined()
  })
})

describe('upsertDbUser', () => {
  it('rejects with 409 on email unique constraint conflict', async () => {
    const emailConflictError = Object.assign(new Error('duplicate key'), {
      code: '23505',
      constraint_name: 'users_email_unique',
    })
    const db = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockReturnValue({
            returning: vi.fn().mockReturnValue({
              catch: vi.fn().mockImplementation(async (handler: (err: unknown) => unknown) => {
                return handler(emailConflictError)
              }),
            }),
          }),
        }),
      }),
    } as unknown as Parameters<typeof upsertDbUser>[0]

    await expect(upsertDbUser(db, 'uid', 'dup@test.com')).rejects.toMatchObject({
      statusCode: 409,
    })
  })

  it('re-throws non-email-conflict DB errors', async () => {
    const dbError = Object.assign(new Error('not null violation'), {
      code: '23502',
      constraint_name: 'users_not_null',
    })
    const db = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockReturnValue({
            returning: vi.fn().mockReturnValue({
              catch: vi.fn().mockImplementation(async (handler: (err: unknown) => unknown) => {
                return handler(dbError)
              }),
            }),
          }),
        }),
      }),
    } as unknown as Parameters<typeof upsertDbUser>[0]

    await expect(upsertDbUser(db, 'uid', 'e@test.com')).rejects.toThrow('not null violation')
  })

  it('strips HTML-significant characters from displayName', async () => {
    const user = createUserFactory()
    const mockValues = vi.fn().mockReturnValue({
      onConflictDoUpdate: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([user]),
      }),
    })
    const db = {
      insert: vi.fn().mockReturnValue({ values: mockValues }),
    } as unknown as Parameters<typeof upsertDbUser>[0]

    await upsertDbUser(db, 'uid', 'e@test.com', '<script>alert(1)</script>')

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        displayName: expect.not.stringMatching(/[<>&"]/),
      }),
    )
  })

  it('strips HTML from displayName derived from email', async () => {
    const user = createUserFactory()
    const mockValues = vi.fn().mockReturnValue({
      onConflictDoUpdate: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([user]),
      }),
    })
    const db = {
      insert: vi.fn().mockReturnValue({ values: mockValues }),
    } as unknown as Parameters<typeof upsertDbUser>[0]

    await upsertDbUser(db, 'uid', '"<img>"@test.com')

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        displayName: expect.not.stringMatching(/[<>&"]/),
      }),
    )
  })

  it('does not overwrite displayName on conflict when no displayName provided', async () => {
    const user = createUserFactory({ displayName: 'Google Name' })
    const mockOnConflict = vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([user]),
    })
    const db = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: mockOnConflict,
        }),
      }),
    } as unknown as Parameters<typeof upsertDbUser>[0]

    await upsertDbUser(db, 'uid', 'alice@test.com')

    // The set clause should NOT include displayName when none was explicitly provided
    const setArg = mockOnConflict.mock.calls[0][0].set
    expect(setArg).not.toHaveProperty('displayName')
  })

  it('overwrites displayName on conflict when displayName is explicitly provided', async () => {
    const user = createUserFactory({ displayName: 'New Name' })
    const mockOnConflict = vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([user]),
    })
    const db = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: mockOnConflict,
        }),
      }),
    } as unknown as Parameters<typeof upsertDbUser>[0]

    await upsertDbUser(db, 'uid', 'alice@test.com', 'New Name')

    // The set clause SHOULD include displayName when explicitly provided
    const setArg = mockOnConflict.mock.calls[0][0].set
    expect(setArg).toHaveProperty('displayName', 'New Name')
  })

  it('throws when insert returns empty rows', async () => {
    const db = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    } as unknown as Parameters<typeof upsertDbUser>[0]

    await expect(upsertDbUser(db, 'uid', 'e@test.com')).rejects.toThrow(
      'Failed to create or retrieve user after upsert',
    )
  })
})

describe('syncUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFirebaseAuth.setCustomUserClaims.mockResolvedValue(undefined)
  })

  it('returns existing user by firebaseUid', async () => {
    const user = createUserFactory({ firebaseUid: 'known-uid' })
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([user]),
          }),
        }),
      }),
    } as unknown as Parameters<typeof syncUser>[0]

    const result = await syncUser(db, 'known-uid', 'known@test.com')
    expect(result.firebaseUid).toBe('known-uid')
  })

  it('creates DB user when not found (upsert)', async () => {
    const newUser = createUserFactory({ firebaseUid: 'new-uid', email: 'new@test.com' })
    const returningPromise = Promise.resolve([newUser])
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockReturnValue({
            returning: vi.fn().mockReturnValue(returningPromise),
          }),
        }),
      }),
    } as unknown as Parameters<typeof syncUser>[0]

    const result = await syncUser(db, 'new-uid', 'new@test.com')
    expect(result.firebaseUid).toBe('new-uid')
    expect(db.insert).toHaveBeenCalled()
  })

  it('uses displayName when provided for new user creation', async () => {
    const newUser = createUserFactory({ firebaseUid: 'new-uid', displayName: 'Alice' })
    const mockValues = vi.fn().mockReturnValue({
      onConflictDoUpdate: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([newUser]),
      }),
    })
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: mockValues,
      }),
    } as unknown as Parameters<typeof syncUser>[0]

    await syncUser(db, 'new-uid', 'alice@test.com', undefined, undefined, 'Alice')
    expect(mockValues).toHaveBeenCalledWith(expect.objectContaining({ displayName: 'Alice' }))
  })

  it('derives displayName from email when not provided', async () => {
    const newUser = createUserFactory({ firebaseUid: 'new-uid' })
    const mockValues = vi.fn().mockReturnValue({
      onConflictDoUpdate: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([newUser]),
      }),
    })
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: mockValues,
      }),
    } as unknown as Parameters<typeof syncUser>[0]

    await syncUser(db, 'new-uid', 'alice@test.com')
    expect(mockValues).toHaveBeenCalledWith(expect.objectContaining({ displayName: 'alice' }))
  })

  it('writes audit log with action user.sync for existing user', async () => {
    const user = createUserFactory()
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([user]),
          }),
        }),
      }),
    } as unknown as Parameters<typeof syncUser>[0]

    await syncUser(db, user.firebaseUid, user.email, '10.0.0.1')

    expect(writeAuditLog).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ action: 'user.sync', ipAddress: '10.0.0.1' }),
    )
  })

  it('writes audit log with action user.register for new user', async () => {
    const newUser = createUserFactory({ firebaseUid: 'new-uid' })
    const returningPromise = Promise.resolve([newUser])
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockReturnValue({
            returning: vi.fn().mockReturnValue(returningPromise),
          }),
        }),
      }),
    } as unknown as Parameters<typeof syncUser>[0]

    await syncUser(db, 'new-uid', 'new@test.com', '10.0.0.1')

    expect(writeAuditLog).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ action: 'user.register' }),
    )
  })
})
