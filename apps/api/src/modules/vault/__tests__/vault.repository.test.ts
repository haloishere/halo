import { describe, it, expect, vi, beforeEach } from 'vitest'
import { randomUUID } from 'crypto'

vi.mock('../../../lib/encryption.js', () => ({
  encryption: {
    encryptField: vi.fn((v: string) => Promise.resolve(`enc:${v}`)),
    decryptField: vi.fn((v: string) => Promise.resolve(v.replace(/^enc:/, ''))),
  },
}))

vi.mock('../../../lib/audit.js', () => ({
  writeAuditLog: vi.fn(() => Promise.resolve()),
}))

const {
  insertVaultEntry,
  findVaultEntryById,
  findVaultEntriesByType,
  softDeleteVaultEntry,
  VAULT_LIST_LIMIT,
} = await import('../vault.repository.js')
const { encryption } = await import('../../../lib/encryption.js')
const { writeAuditLog } = await import('../../../lib/audit.js')

// ─── Fixtures ────────────────────────────────────────────────────────────────

const USER_ID = '11111111-1111-1111-1111-111111111111'
const ENTRY_ID = '22222222-2222-2222-2222-222222222222'

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ENTRY_ID,
    userId: USER_ID,
    type: 'preference',
    // ciphertext as it would appear in DB
    content: 'enc:{"category":"food","subject":"sushi","sentiment":"likes","confidence":0.9}',
    createdAt: new Date('2026-04-18T10:00:00Z'),
    updatedAt: new Date('2026-04-18T10:00:00Z'),
    deletedAt: null,
    ...overrides,
  }
}

function insertingDb(returnedRow: ReturnType<typeof makeRow>) {
  return {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([returnedRow]),
      }),
    }),
  } as unknown as Parameters<typeof insertVaultEntry>[0]
}

interface SelectSpy {
  db: Parameters<typeof findVaultEntryById>[0]
  limit: ReturnType<typeof vi.fn>
  orderBy: ReturnType<typeof vi.fn>
}

function selectingDb(rows: ReturnType<typeof makeRow>[]): SelectSpy {
  const limit = vi.fn().mockImplementation((n: number) =>
    // findById path asks for at most 1; findByType asks for VAULT_LIST_LIMIT
    Promise.resolve(n === 1 ? rows.slice(0, 1) : rows),
  )
  // findById path ends at .limit(1); findByType chains .orderBy(...).limit(VAULT_LIST_LIMIT).
  const orderBy = vi.fn().mockReturnValue({ limit })
  const db = {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ orderBy, limit }),
      }),
    }),
  } as unknown as Parameters<typeof findVaultEntryById>[0]
  return { db, limit, orderBy }
}

function updatingDb(returnedRow: ReturnType<typeof makeRow>) {
  return {
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([returnedRow]),
        }),
      }),
    }),
  } as unknown as Parameters<typeof softDeleteVaultEntry>[0]
}

// ─── insertVaultEntry ────────────────────────────────────────────────────────

describe('insertVaultEntry', () => {
  beforeEach(() => vi.clearAllMocks())

  it('encrypts content via the encryption singleton before insert', async () => {
    const row = makeRow()
    const db = insertingDb(row)

    await insertVaultEntry(db, USER_ID, {
      type: 'preference',
      content: { category: 'food', subject: 'sushi', sentiment: 'likes', confidence: 0.9 },
    })

    expect(encryption.encryptField).toHaveBeenCalledTimes(1)
    const [plaintext, userId] = (encryption.encryptField as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(userId).toBe(USER_ID)
    // plaintext is the JSON-serialized content
    expect(JSON.parse(plaintext)).toEqual({
      category: 'food',
      subject: 'sushi',
      sentiment: 'likes',
      confidence: 0.9,
    })
  })

  it('returns a record with decrypted content (no ciphertext leak to caller)', async () => {
    const row = makeRow()
    const db = insertingDb(row)

    const result = await insertVaultEntry(db, USER_ID, {
      type: 'preference',
      content: { category: 'food', subject: 'sushi', sentiment: 'likes', confidence: 0.9 },
    })

    expect(result.id).toBe(ENTRY_ID)
    expect(result.userId).toBe(USER_ID)
    expect(result.type).toBe('preference')
    expect(result.content).toEqual({
      category: 'food',
      subject: 'sushi',
      sentiment: 'likes',
      confidence: 0.9,
    })
    // Ensure no field leaks ciphertext
    expect(JSON.stringify(result)).not.toContain('enc:')
  })

  it('writes an audit log row with action vault.write', async () => {
    const row = makeRow()
    const db = insertingDb(row)

    await insertVaultEntry(db, USER_ID, {
      type: 'preference',
      content: { category: 'food', subject: 'sushi', sentiment: 'likes', confidence: 0.9 },
    })

    expect(writeAuditLog).toHaveBeenCalledTimes(1)
    expect(writeAuditLog).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        userId: USER_ID,
        action: 'vault.write',
        resource: 'vault_entry',
        resourceId: ENTRY_ID,
      }),
    )
  })

  it('does not include the plaintext content in the audit metadata', async () => {
    const row = makeRow()
    const db = insertingDb(row)

    await insertVaultEntry(db, USER_ID, {
      type: 'preference',
      content: { category: 'food', subject: 'sushi', sentiment: 'likes', confidence: 0.9 },
    })

    const auditCall = (writeAuditLog as ReturnType<typeof vi.fn>).mock.calls[0][1]
    expect(JSON.stringify(auditCall)).not.toContain('sushi')
  })
})

// ─── findVaultEntryById ──────────────────────────────────────────────────────

describe('findVaultEntryById', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns a decrypted record when found', async () => {
    const { db } = selectingDb([makeRow()])
    const result = await findVaultEntryById(db, USER_ID, ENTRY_ID)
    expect(result).not.toBeNull()
    expect(result?.content).toEqual({
      category: 'food',
      subject: 'sushi',
      sentiment: 'likes',
      confidence: 0.9,
    })
  })

  it('returns null when no row matches', async () => {
    const { db } = selectingDb([])
    const result = await findVaultEntryById(db, USER_ID, randomUUID())
    expect(result).toBeNull()
  })
})

// ─── findVaultEntriesByType ──────────────────────────────────────────────────

describe('findVaultEntriesByType', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns decrypted records of the requested type', async () => {
    const { db } = selectingDb([makeRow(), makeRow({ id: randomUUID() })])
    const result = await findVaultEntriesByType(db, USER_ID, 'preference')
    expect(result).toHaveLength(2)
    expect(result[0]?.type).toBe('preference')
    expect(result[0]?.content).toMatchObject({ subject: 'sushi' })
  })

  it('returns an empty array when no rows match', async () => {
    const { db } = selectingDb([])
    const result = await findVaultEntriesByType(db, USER_ID, 'preference')
    expect(result).toEqual([])
  })

  it('caps the query with VAULT_LIST_LIMIT (guards against unbounded decrypt)', async () => {
    const { db, limit } = selectingDb([makeRow()])
    await findVaultEntriesByType(db, USER_ID, 'preference')
    expect(limit).toHaveBeenCalledWith(VAULT_LIST_LIMIT)
  })

  it('orders results deterministically (createdAt desc, id desc) for stable pagination', async () => {
    const { db, orderBy } = selectingDb([makeRow()])
    await findVaultEntriesByType(db, USER_ID, 'preference')
    // Mirrors every other paginated list query in the codebase
    // (community posts, ai-chat conversations, follows): without a deterministic
    // ORDER BY, Stage 3 cursor pagination will break and the mobile list jitters.
    expect(orderBy).toHaveBeenCalledTimes(1)
    expect(orderBy.mock.calls[0]).toHaveLength(2)
  })

  it('continues if a single row fails to decrypt (returns placeholder)', async () => {
    const ok = makeRow()
    const corrupted = makeRow({ id: randomUUID(), content: 'bad-cipher' })
    const { db } = selectingDb([ok, corrupted])

    const mockDecrypt = vi.mocked(encryption.decryptField)
    mockDecrypt.mockImplementation((v: string) =>
      v === 'bad-cipher'
        ? Promise.reject(new Error('Invalid ciphertext'))
        : Promise.resolve(v.replace(/^enc:/, '')),
    )

    const result = await findVaultEntriesByType(db, USER_ID, 'preference')
    expect(result).toHaveLength(2)
    expect(result[0]?.content).toMatchObject({ subject: 'sushi' })
    expect(result[1]?.content).toBeNull()
  })
})

// ─── softDeleteVaultEntry ────────────────────────────────────────────────────

describe('softDeleteVaultEntry', () => {
  beforeEach(() => vi.clearAllMocks())

  it('writes a deletedAt timestamp via UPDATE', async () => {
    const db = updatingDb(makeRow({ deletedAt: new Date() }))
    await softDeleteVaultEntry(db, USER_ID, ENTRY_ID)

    expect(db.update).toHaveBeenCalledTimes(1)
    const setMock = (db.update as ReturnType<typeof vi.fn>).mock.results[0].value.set
    const setArg = setMock.mock.calls[0][0]
    expect(setArg.deletedAt).toBeInstanceOf(Date)
  })

  it('writes an audit log row with action vault.delete', async () => {
    const db = updatingDb(makeRow({ deletedAt: new Date() }))
    await softDeleteVaultEntry(db, USER_ID, ENTRY_ID)

    expect(writeAuditLog).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        userId: USER_ID,
        action: 'vault.delete',
        resource: 'vault_entry',
        resourceId: ENTRY_ID,
      }),
    )
  })

  it('second soft-delete on the same id throws not-found (idempotency guard)', async () => {
    // First call: row exists and gets its deletedAt stamped.
    const firstDb = updatingDb(makeRow({ deletedAt: new Date() }))
    await softDeleteVaultEntry(firstDb, USER_ID, ENTRY_ID)

    // Second call: the `isNull(deletedAt)` WHERE filter now excludes the row,
    // so UPDATE ... RETURNING comes back empty and the repo throws 404.
    const secondDb = {
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    } as unknown as Parameters<typeof softDeleteVaultEntry>[0]

    await expect(softDeleteVaultEntry(secondDb, USER_ID, ENTRY_ID)).rejects.toThrow(
      'Vault entry not found',
    )
  })

  it('throws not-found when the row does not exist or belongs to another user', async () => {
    const db = {
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    } as unknown as Parameters<typeof softDeleteVaultEntry>[0]

    await expect(softDeleteVaultEntry(db, USER_ID, ENTRY_ID)).rejects.toThrow(
      'Vault entry not found',
    )
  })
})
