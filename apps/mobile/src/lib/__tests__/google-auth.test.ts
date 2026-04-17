import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockConfigure, mockHasPlayServices, mockSignIn, mockSignInWithCredential } = vi.hoisted(
  () => ({
    mockConfigure: vi.fn(),
    mockHasPlayServices: vi.fn(),
    mockSignIn: vi.fn(),
    mockSignInWithCredential: vi.fn(),
  }),
)

vi.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: mockConfigure,
    hasPlayServices: mockHasPlayServices,
    signIn: mockSignIn,
    signOut: vi.fn().mockResolvedValue(null),
  },
  statusCodes: {
    SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
    IN_PROGRESS: 'IN_PROGRESS',
    PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
  },
  isErrorWithCode: (err: unknown): err is { code: string } => err instanceof Error && 'code' in err,
}))

vi.mock('firebase/auth', () => ({
  initializeAuth: vi.fn(() => ({})),
  getAuth: vi.fn(() => ({})),
  getReactNativePersistence: vi.fn(() => ({})),
  GoogleAuthProvider: {
    credential: vi.fn((idToken: string) => ({ idToken, providerId: 'google.com' })),
  },
  signInWithCredential: mockSignInWithCredential,
}))

vi.mock('../firebase', () => ({
  auth: { currentUser: null },
}))

import { configureGoogleSignIn, signInWithGoogle } from '../google-auth'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('configureGoogleSignIn', () => {
  it('calls GoogleSignin.configure with webClientId', () => {
    configureGoogleSignIn('test-web-client-id')
    expect(mockConfigure).toHaveBeenCalledWith({ webClientId: 'test-web-client-id' })
  })
})

describe('signInWithGoogle', () => {
  it('calls hasPlayServices + signIn and returns Firebase UserCredential', async () => {
    mockHasPlayServices.mockResolvedValue(true)
    mockSignIn.mockResolvedValue({
      data: { idToken: 'google-id-token', user: { email: 'test@gmail.com' } },
    })
    const mockCredential = { user: { uid: 'firebase-uid' } }
    mockSignInWithCredential.mockResolvedValue(mockCredential)

    const result = await signInWithGoogle()

    expect(mockHasPlayServices).toHaveBeenCalled()
    expect(mockSignIn).toHaveBeenCalled()
    expect(mockSignInWithCredential).toHaveBeenCalled()
    expect(result).toBe(mockCredential)
  })

  it('returns null when idToken is missing (incomplete sign-in)', async () => {
    mockHasPlayServices.mockResolvedValue(true)
    mockSignIn.mockResolvedValue({
      data: { idToken: null, user: { email: 'test@gmail.com' } },
    })

    const result = await signInWithGoogle()

    expect(result).toBeNull()
    expect(mockSignInWithCredential).not.toHaveBeenCalled()
  })

  it('returns null when user cancels (SIGN_IN_CANCELLED)', async () => {
    mockHasPlayServices.mockResolvedValue(true)
    const cancelError = Object.assign(new Error('Sign in cancelled'), {
      code: 'SIGN_IN_CANCELLED',
    })
    mockSignIn.mockRejectedValue(cancelError)

    const result = await signInWithGoogle()

    expect(result).toBeNull()
  })

  it('throws on Play Services unavailable', async () => {
    mockHasPlayServices.mockResolvedValue(true)
    const psError = Object.assign(new Error('Play services not available'), {
      code: 'PLAY_SERVICES_NOT_AVAILABLE',
    })
    mockSignIn.mockRejectedValue(psError)

    await expect(signInWithGoogle()).rejects.toThrow('Play services not available')
  })

  it('re-throws unknown errors', async () => {
    mockHasPlayServices.mockResolvedValue(true)
    mockSignIn.mockRejectedValue(new Error('Network timeout'))

    await expect(signInWithGoogle()).rejects.toThrow('Network timeout')
  })

  it('throws when hasPlayServices() rejects', async () => {
    mockHasPlayServices.mockRejectedValue(
      Object.assign(new Error('Play Services unavailable'), {
        code: 'PLAY_SERVICES_NOT_AVAILABLE',
      }),
    )

    await expect(signInWithGoogle()).rejects.toThrow('Play Services unavailable')
    expect(mockSignIn).not.toHaveBeenCalled()
  })
})
