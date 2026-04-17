import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHash } from 'crypto'
import { writeAuditLog } from '../audit.js'

function makeDb(insertFn = vi.fn().mockResolvedValue(undefined)) {
  return {
    insert: vi.fn().mockReturnValue({
      values: insertFn,
    }),
  } as unknown as Parameters<typeof writeAuditLog>[0]
}

describe('writeAuditLog', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('SHA-256 hashes the IP address before insert', async () => {
    const valuesFn = vi.fn().mockResolvedValue(undefined)
    const db = makeDb(valuesFn)
    const ip = '203.0.113.42'

    await writeAuditLog(db, { action: 'user.register', resource: 'user', ipAddress: ip })

    const expectedHash = createHash('sha256').update(ip).digest('hex')
    expect(valuesFn).toHaveBeenCalledWith(expect.objectContaining({ ipAddress: expectedHash }))
  })

  it('same IP always produces identical hash (deterministic)', async () => {
    const calls: string[] = []
    for (let i = 0; i < 2; i++) {
      const valuesFn = vi.fn().mockResolvedValue(undefined)
      const db = makeDb(valuesFn)
      await writeAuditLog(db, { action: 'user.sync', resource: 'user', ipAddress: '10.0.0.1' })
      const { ipAddress } = valuesFn.mock.calls[0][0]
      calls.push(ipAddress)
    }
    expect(calls[0]).toBe(calls[1])
  })

  it('stores null when ipAddress is undefined', async () => {
    const valuesFn = vi.fn().mockResolvedValue(undefined)
    const db = makeDb(valuesFn)

    await writeAuditLog(db, { action: 'user.sync', resource: 'user' })

    expect(valuesFn).toHaveBeenCalledWith(expect.objectContaining({ ipAddress: null }))
  })

  it('DB insert failure does NOT propagate — caller continues normally', async () => {
    const valuesFn = vi.fn().mockRejectedValue(new Error('DB connection lost'))
    const db = makeDb(valuesFn)
    const mockLogger = {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
      trace: vi.fn(),
      fatal: vi.fn(),
    }

    // Should NOT throw
    await expect(
      writeAuditLog(db, { action: 'user.register', resource: 'user' }, mockLogger),
    ).resolves.toBeUndefined()

    // Verify error was logged via pino logger
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'user.register', resource: 'user' }),
      'Failed to write audit log',
    )
  })

  it('metadata accepts nested JSON', async () => {
    const valuesFn = vi.fn().mockResolvedValue(undefined)
    const db = makeDb(valuesFn)
    const metadata = { reason: 'test', nested: { count: 3, tags: ['a', 'b'] } }

    await writeAuditLog(db, { action: 'user.register', resource: 'user', metadata })

    expect(valuesFn).toHaveBeenCalledWith(expect.objectContaining({ metadata }))
  })

  it('metadata defaults to null when not provided', async () => {
    const valuesFn = vi.fn().mockResolvedValue(undefined)
    const db = makeDb(valuesFn)

    await writeAuditLog(db, { action: 'test.action', resource: 'resource' })

    expect(valuesFn).toHaveBeenCalledWith(expect.objectContaining({ metadata: null }))
  })

  it('truncates User-Agent to 512 characters', async () => {
    const valuesFn = vi.fn().mockResolvedValue(undefined)
    const db = makeDb(valuesFn)
    const longUA = 'A'.repeat(1024)

    await writeAuditLog(db, { action: 'test', resource: 'resource', userAgent: longUA })

    const { userAgent } = valuesFn.mock.calls[0][0]
    expect(userAgent).toHaveLength(512)
    expect(userAgent).toBe('A'.repeat(512))
  })

  it('does not include createdAt in insert values (set by DB defaultNow)', async () => {
    const valuesFn = vi.fn().mockResolvedValue(undefined)
    const db = makeDb(valuesFn)

    await writeAuditLog(db, { action: 'test', resource: 'resource' })

    const insertedValues = valuesFn.mock.calls[0][0]
    expect(insertedValues).not.toHaveProperty('createdAt')
  })
})
