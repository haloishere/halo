import { FirebaseError } from 'firebase/app'
import { isErrorWithCode } from '@react-native-google-signin/google-signin'

/** Map known Google Sign-In error codes to user-friendly text. null = user cancelled (not an error). */
const GOOGLE_ERROR_MAP: Record<string, string | null> = {
  PLAY_SERVICES_NOT_AVAILABLE: 'Google Play Services is required. Please update it and try again.',
  IN_PROGRESS: 'Sign-in already in progress. Please wait.',
  SIGN_IN_CANCELLED: null,
}

/** Map known OTP API error messages to user-friendly text. */
const OTP_ERROR_MAP: Record<string, string> = {
  'Invalid code': 'The code you entered is incorrect. Please try again.',
  'Code expired or not found': 'This code has expired. Please request a new one.',
  'Too many attempts. Request a new code.':
    'Too many incorrect attempts. Please request a new code.',
}

export function getAuthErrorMessage(err: unknown): string | null {
  if (err instanceof FirebaseError) {
    switch (err.code) {
      case 'auth/user-not-found':
      case 'auth/invalid-credential':
        return 'Invalid credentials.'
      case 'auth/user-disabled':
        return 'This account has been disabled. Please contact support.'
      case 'auth/id-token-revoked':
      case 'auth/id-token-expired':
        return 'Your session has expired. Please sign in again.'
      case 'auth/too-many-requests':
        return 'Too many attempts. Please try again later.'
      case 'auth/network-request-failed':
        return 'Network error. Please check your connection.'
      case 'auth/email-already-in-use':
        return 'An account with this email already exists.'
      default:
        if (__DEV__) console.warn('[auth] Unhandled Firebase error:', err.code)
        return 'Something went wrong. Please try again.'
    }
  }

  // Google Sign-In errors — null means user cancelled (not an error)
  if (isErrorWithCode(err) && err.code in GOOGLE_ERROR_MAP) {
    return GOOGLE_ERROR_MAP[err.code] ?? null
  }

  // OTP API errors come as plain Error instances
  if (err instanceof Error && err.message in OTP_ERROR_MAP) {
    return OTP_ERROR_MAP[err.message]!
  }

  if (__DEV__) {
    const detail = err instanceof Error ? err.message : String(err)
    console.warn('[auth] Unhandled auth error:', detail)
  }
  return 'Something went wrong. Please try again.'
}
