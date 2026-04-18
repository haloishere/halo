import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createUserFactory } from '../../test/factories/index.js'

const { getProfile, updateOnboarding } = await import('./users.service.js')

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
