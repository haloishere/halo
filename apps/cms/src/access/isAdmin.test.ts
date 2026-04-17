import { describe, it, expect } from 'vitest'
import { isAdmin, isAdminOrEditor } from './isAdmin'

/**
 * Helper to build a minimal Payload access control argument.
 * Payload passes `{ req: { user } }` to access functions.
 */
function accessArgs(user: { role: string } | null) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { req: { user } } as any
}

describe('isAdmin', () => {
  it('returns true when user role is admin', () => {
    expect(isAdmin(accessArgs({ role: 'admin' }))).toBe(true)
  })

  it('returns false when user role is editor', () => {
    expect(isAdmin(accessArgs({ role: 'editor' }))).toBe(false)
  })

  it('returns false when user role is user', () => {
    expect(isAdmin(accessArgs({ role: 'user' }))).toBe(false)
  })

  it('returns false when user is null (unauthenticated)', () => {
    expect(isAdmin(accessArgs(null))).toBe(false)
  })

  it('returns false when user is undefined', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(isAdmin({ req: { user: undefined } } as any)).toBe(false)
  })
})

describe('isAdminOrEditor', () => {
  it('returns true when user role is admin', () => {
    expect(isAdminOrEditor(accessArgs({ role: 'admin' }))).toBe(true)
  })

  it('returns true when user role is editor', () => {
    expect(isAdminOrEditor(accessArgs({ role: 'editor' }))).toBe(true)
  })

  it('returns false when user role is user', () => {
    expect(isAdminOrEditor(accessArgs({ role: 'user' }))).toBe(false)
  })

  it('returns false when user role is moderator', () => {
    expect(isAdminOrEditor(accessArgs({ role: 'moderator' }))).toBe(false)
  })

  it('returns false when user is null (unauthenticated)', () => {
    expect(isAdminOrEditor(accessArgs(null))).toBe(false)
  })

  it('returns false when user is undefined', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(isAdminOrEditor({ req: { user: undefined } } as any)).toBe(false)
  })
})
