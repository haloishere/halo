import { describe, it, expect } from 'vitest'
import { FirebaseError } from 'firebase/app'
import { getAuthErrorMessage } from '../auth-errors'

function makeFirebaseError(code: string): FirebaseError {
  return new FirebaseError(code, `Firebase: Error (${code}).`)
}

describe('getAuthErrorMessage', () => {
  it.each([
    ['auth/user-not-found', 'Invalid credentials.'],
    ['auth/invalid-credential', 'Invalid credentials.'],
  ])('maps %s to generic credentials message', (code, expected) => {
    expect(getAuthErrorMessage(makeFirebaseError(code))).toBe(expected)
  })

  it('maps auth/user-disabled to disabled account message', () => {
    expect(getAuthErrorMessage(makeFirebaseError('auth/user-disabled'))).toBe(
      'This account has been disabled. Please contact support.',
    )
  })

  it('maps auth/too-many-requests to rate limit message', () => {
    expect(getAuthErrorMessage(makeFirebaseError('auth/too-many-requests'))).toBe(
      'Too many attempts. Please try again later.',
    )
  })

  it('maps auth/network-request-failed to network message', () => {
    expect(getAuthErrorMessage(makeFirebaseError('auth/network-request-failed'))).toBe(
      'Network error. Please check your connection.',
    )
  })

  it('maps auth/email-already-in-use to duplicate account message', () => {
    expect(getAuthErrorMessage(makeFirebaseError('auth/email-already-in-use'))).toBe(
      'An account with this email already exists.',
    )
  })

  it.each([
    ['auth/id-token-revoked', 'Your session has expired. Please sign in again.'],
    ['auth/id-token-expired', 'Your session has expired. Please sign in again.'],
  ])('maps %s to session expired message', (code, expected) => {
    expect(getAuthErrorMessage(makeFirebaseError(code))).toBe(expected)
  })

  it('maps unknown Firebase error codes to generic message', () => {
    expect(getAuthErrorMessage(makeFirebaseError('auth/unknown-code'))).toBe(
      'Something went wrong. Please try again.',
    )
  })

  // OTP API error mappings
  it('maps "Invalid code" OTP error to user-friendly message', () => {
    expect(getAuthErrorMessage(new Error('Invalid code'))).toBe(
      'The code you entered is incorrect. Please try again.',
    )
  })

  it('maps "Code expired or not found" OTP error to user-friendly message', () => {
    expect(getAuthErrorMessage(new Error('Code expired or not found'))).toBe(
      'This code has expired. Please request a new one.',
    )
  })

  it('maps "Too many attempts" OTP error to user-friendly message', () => {
    expect(getAuthErrorMessage(new Error('Too many attempts. Request a new code.'))).toBe(
      'Too many incorrect attempts. Please request a new code.',
    )
  })

  // Google Sign-In error mappings
  it('maps PLAY_SERVICES_NOT_AVAILABLE to Play Services message', () => {
    const err = Object.assign(new Error('Play services'), {
      code: 'PLAY_SERVICES_NOT_AVAILABLE',
    })
    expect(getAuthErrorMessage(err)).toBe(
      'Google Play Services is required. Please update it and try again.',
    )
  })

  it('maps IN_PROGRESS to in-progress message', () => {
    const err = Object.assign(new Error('In progress'), { code: 'IN_PROGRESS' })
    expect(getAuthErrorMessage(err)).toBe('Sign-in already in progress. Please wait.')
  })

  it('returns null for SIGN_IN_CANCELLED (user intentionally cancelled)', () => {
    const err = Object.assign(new Error('Cancelled'), { code: 'SIGN_IN_CANCELLED' })
    expect(getAuthErrorMessage(err)).toBeNull()
  })

  it('maps non-Error values to generic message', () => {
    expect(getAuthErrorMessage('string error')).toBe('Something went wrong. Please try again.')
    expect(getAuthErrorMessage(null)).toBe('Something went wrong. Please try again.')
    expect(getAuthErrorMessage(undefined)).toBe('Something went wrong. Please try again.')
  })

  it('maps unknown Error messages to generic message', () => {
    expect(getAuthErrorMessage(new Error('random error'))).toBe(
      'Something went wrong. Please try again.',
    )
  })
})
