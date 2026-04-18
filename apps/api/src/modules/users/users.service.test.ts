import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createUserFactory, createCareRecipientFactory } from '../../test/factories/index.js'

// Mock encryption before import
vi.mock('../../lib/encryption.js', () => ({
  encryption: {
    encryptField: vi.fn().mockImplementation((v: string) => Promise.resolve(`enc:${v}`)),
    decryptField: vi.fn().mockImplementation((v: string) => Promise.resolve(v.replace('enc:', ''))),
  },
}))

const {
  getProfile,
  updateOnboarding,
  createCareRecipient,
  listCareRecipients,
  updateCareRecipient,
  deleteCareRecipient,
} = await import('./users.service.js')
const { encryption } = await import('../../lib/encryption.js')

// ─── DB helpers ─────────────────────────────────────────────────────────────

function makeUserDb(user: ReturnType<typeof createUserFactory> | null = createUserFactory()) {
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(user ? [user] : []),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi
            .fn()
            .mockResolvedValue(user ? [{ ...user, onboardingCompleted: new Date() }] : []),
        }),
      }),
    }),
  } as unknown as Parameters<typeof getProfile>[0]
}

function makeCareDb(records: ReturnType<typeof createCareRecipientFactory>[] = []) {
  const single = records[0] ?? null
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(single ? [single] : []),
          // for list (no limit)
          then: undefined,
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue(single ? [single] : []),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue(single ? [single] : []),
        }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  } as unknown as Parameters<typeof createCareRecipient>[0]
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('getProfile', () => {
  it('returns user when found', async () => {
    const user = createUserFactory()
    const db = makeUserDb(user)
    const result = await getProfile(db, user.id)
    expect(result).not.toBeNull()
    expect(result?.id).toBe(user.id)
  })

  it('returns null when user does not exist', async () => {
    const db = makeUserDb(null)
    const result = await getProfile(db, 'non-existent-id')
    expect(result).toBeNull()
  })
})

describe('updateOnboarding', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sets onboardingCompleted to a timestamp', async () => {
    const user = createUserFactory()
    const db = makeUserDb(user)
    const result = await updateOnboarding(db, user.id, { city: 'Luzern' })
    expect(result.onboardingCompleted).toBeInstanceOf(Date)
  })

  it('includes displayName in DB set() call when provided', async () => {
    const user = createUserFactory()
    const db = makeUserDb(user)
    await updateOnboarding(db, user.id, { displayName: 'Alice', city: 'Luzern' })
    const setMock = (db.update as ReturnType<typeof vi.fn>).mock.results[0].value.set
    expect(setMock).toHaveBeenCalledWith(expect.objectContaining({ displayName: 'Alice' }))
  })

  it('sanitizes displayName by stripping HTML-significant characters', async () => {
    const user = createUserFactory()
    const db = makeUserDb(user)
    await updateOnboarding(db, user.id, { displayName: 'Test Name', city: 'Luzern' })
    const setMock = (db.update as ReturnType<typeof vi.fn>).mock.results[0].value.set
    const setArg = setMock.mock.calls[0][0]
    expect(setArg.displayName).toBe('Test Name')
  })

  it('does not set displayName when sanitization produces empty string', async () => {
    const user = createUserFactory()
    const db = makeUserDb(user)
    await updateOnboarding(db, user.id, { displayName: '<>&"', city: 'Luzern' })
    const setMock = (db.update as ReturnType<typeof vi.fn>).mock.results[0].value.set
    const setArg = setMock.mock.calls[0][0]
    expect(setArg).not.toHaveProperty('displayName')
  })

  it('does not include displayName in DB set() call when omitted', async () => {
    const user = createUserFactory()
    const db = makeUserDb(user)
    await updateOnboarding(db, user.id, { city: 'Luzern' })
    const setMock = (db.update as ReturnType<typeof vi.fn>).mock.results[0].value.set
    const setArg = setMock.mock.calls[0][0]
    expect(setArg).not.toHaveProperty('displayName')
  })

  it('is idempotent — second call succeeds without error', async () => {
    const user = createUserFactory({ onboardingCompleted: new Date() })
    const db = makeUserDb(user)
    for (let i = 0; i < 2; i++) {
      await expect(updateOnboarding(db, user.id, { city: 'Luzern' })).resolves.toBeDefined()
    }
  })
})

describe('createCareRecipient', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls encryptField for name, diagnosisDetails, and dateOfBirth', async () => {
    const record = createCareRecipientFactory({ name: 'enc:John', diagnosisDetails: 'enc:details' })
    const db = makeCareDb([record])

    await createCareRecipient(db, 'user-1', {
      name: 'John',
      relationship: 'spouse',
      diagnosisStage: 'middle',
      diagnosisDetails: 'some details',
      dateOfBirth: '1950-01-01',
    })

    expect(encryption.encryptField).toHaveBeenCalledWith('John', 'user-1')
    expect(encryption.encryptField).toHaveBeenCalledWith('some details', 'user-1')
    expect(encryption.encryptField).toHaveBeenCalledWith('1950-01-01', 'user-1')
  })

  it('does not encrypt optional fields when not provided', async () => {
    const record = createCareRecipientFactory()
    const db = makeCareDb([record])

    await createCareRecipient(db, 'user-1', {
      name: 'Jane',
      relationship: 'child',
      diagnosisStage: 'early',
    })

    // encryptField called only once (for name)
    expect(encryption.encryptField).toHaveBeenCalledTimes(1)
  })

  it('returns decrypted fields (C1 fix — no ciphertext leak to client)', async () => {
    const record = createCareRecipientFactory({ name: 'enc:John', diagnosisDetails: 'enc:details' })
    const db = makeCareDb([record])

    const result = await createCareRecipient(db, 'user-1', {
      name: 'John',
      relationship: 'spouse',
      diagnosisStage: 'middle',
      diagnosisDetails: 'some details',
    })

    expect(result.name).toBe('John')
    expect(result.diagnosisDetails).toBe('details')
  })
})

describe('listCareRecipients', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls decryptField for each encrypted field', async () => {
    const records = [
      createCareRecipientFactory({ name: 'enc:Alice', diagnosisDetails: 'enc:detail1' }),
      createCareRecipientFactory({ name: 'enc:Bob' }),
    ]
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(records),
        }),
      }),
    } as unknown as Parameters<typeof listCareRecipients>[0]

    const result = await listCareRecipients(db, 'user-1')
    expect(result[0].name).toBe('Alice')
    expect(encryption.decryptField).toHaveBeenCalledWith('enc:Alice', 'user-1')
  })

  it('returns placeholder for corrupted records instead of failing entire list (H6 fix)', async () => {
    const good = createCareRecipientFactory({ name: 'enc:Alice' })
    const corrupted = createCareRecipientFactory({ id: 'corrupted-id', name: 'bad-cipher' })
    const records = [good, corrupted]

    // Mock decryptField to fail on 'bad-cipher'
    const mockDecrypt = vi.mocked(encryption.decryptField)
    mockDecrypt.mockImplementation((v: string) => {
      if (v === 'bad-cipher') return Promise.reject(new Error('Invalid ciphertext format'))
      return Promise.resolve(v.replace('enc:', ''))
    })

    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(records),
        }),
      }),
    } as unknown as Parameters<typeof listCareRecipients>[0]

    const result = await listCareRecipients(db, 'user-1')
    expect(result).toHaveLength(2)
    expect(result[0].name).toBe('Alice')
    // Corrupted record should have placeholder name
    expect(result[1].name).toBe('[Decryption failed]')
    expect(result[1].id).toBe('corrupted-id')
  })
})

describe('updateCareRecipient', () => {
  beforeEach(() => vi.clearAllMocks())

  it('re-encrypts only the fields present in the update', async () => {
    const record = createCareRecipientFactory()
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([record]),
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([record]),
          }),
        }),
      }),
    } as unknown as Parameters<typeof updateCareRecipient>[0]

    await updateCareRecipient(db, record.userId, record.id, { name: 'New Name' })

    expect(encryption.encryptField).toHaveBeenCalledWith('New Name', record.userId)
    expect(encryption.encryptField).toHaveBeenCalledTimes(1) // only name, not other fields
  })
})

describe('deleteCareRecipient', () => {
  it('throws not-found when recipient belongs to different user', async () => {
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]), // not found
          }),
        }),
      }),
    } as unknown as Parameters<typeof deleteCareRecipient>[0]

    await expect(deleteCareRecipient(db, 'wrong-user-id', 'some-id')).rejects.toThrow(
      'Care recipient not found',
    )
  })
})
