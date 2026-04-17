import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, act } from '../../../src/test/render'

const mockShow = vi.fn()

const { mockSendOtp, mockRouterPush, mockGoogleMutateAsync, mockGoogleIsPending, mockSignOut } =
  vi.hoisted(() => ({
    mockSendOtp: vi.fn(),
    mockRouterPush: vi.fn(),
    mockGoogleMutateAsync: vi.fn(),
    mockGoogleIsPending: { value: false },
    mockSignOut: vi.fn().mockResolvedValue(undefined),
  }))

vi.mock('expo-router', () => ({
  router: { push: mockRouterPush, replace: vi.fn() },
  Link: ({ children, style }: { children: React.ReactNode; href: string; style?: unknown }) =>
    React.createElement('Text', { style }, children),
}))

vi.mock('../../../src/api/otp', () => ({
  useSendOtpMutation: () => ({
    mutateAsync: mockSendOtp,
    isPending: false,
  }),
}))

vi.mock('../../../src/api/google-auth', () => ({
  useGoogleSignInMutation: () => ({
    mutateAsync: mockGoogleMutateAsync,
    isPending: mockGoogleIsPending.value,
  }),
}))

vi.mock('../../../src/stores/theme', () => ({
  useThemeStore: () => ({ mode: 'light', setMode: vi.fn() }),
}))

vi.mock('../../../src/lib/resolve-theme', () => ({
  resolveTheme: () => 'light',
}))

vi.mock('firebase/auth', async () => {
  const actual = await vi.importActual('firebase/auth')
  return {
    ...actual,
    initializeAuth: vi.fn(() => ({})),
    getReactNativePersistence: vi.fn(() => ({})),
    signOut: mockSignOut,
  }
})

vi.mock('@tamagui/toast', () => ({
  useToastController: () => ({ show: mockShow, hide: vi.fn(), nativeToast: vi.fn() }),
  useToastState: () => null,
  ToastProvider: ({ children }: { children: unknown }) => children,
  ToastViewport: () => null,
  Toast: Object.assign(() => null, {
    Title: () => null,
    Description: () => null,
    Action: () => null,
    Close: () => null,
  }),
}))

import { useAuthStore } from '../../../src/stores/auth'
import EnterEmailScreen from '../enter-email'

beforeEach(() => {
  mockSendOtp.mockReset()
  mockRouterPush.mockReset()
  mockShow.mockReset()
  mockGoogleMutateAsync.mockReset()
  mockSignOut.mockReset()
  mockGoogleIsPending.value = false
  useAuthStore.setState({ user: null, dbUser: null, isLoading: false, syncError: null })
})

describe('EnterEmailScreen — rendering', () => {
  it('renders email input and Continue button', () => {
    const { getByLabelText } = render(<EnterEmailScreen />)
    expect(getByLabelText('Email address')).toBeTruthy()
    expect(getByLabelText('Continue')).toBeTruthy()
  })

  it('renders brand logo', () => {
    const { getAllByText } = render(<EnterEmailScreen />)
    // BrandLogo renders each letter individually when animated
    expect(getAllByText('h').length).toBeGreaterThanOrEqual(1)
  })

  it('renders theme toggle switch', () => {
    const { getByRole } = render(<EnterEmailScreen />)
    expect(getByRole('switch')).toBeTruthy()
  })

  it('renders heading', () => {
    const { getByText } = render(<EnterEmailScreen />)
    expect(getByText("Let's get started")).toBeTruthy()
  })

  it('renders Google login button', () => {
    const { getByLabelText } = render(<EnterEmailScreen />)
    expect(getByLabelText('Continue with Google')).toBeTruthy()
  })
})

describe('EnterEmailScreen — validation on submit', () => {
  it('does not show error before pressing Continue', () => {
    const { getByLabelText, queryByText } = render(<EnterEmailScreen />)
    fireEvent.changeText(getByLabelText('Email address'), 'not-an-email')
    expect(queryByText('Please enter a valid email address.')).toBeNull()
  })

  it('shows validation error after pressing Continue with invalid email', async () => {
    const { getByLabelText, getByText } = render(<EnterEmailScreen />)
    fireEvent.changeText(getByLabelText('Email address'), 'not-an-email')
    await act(async () => {
      fireEvent.press(getByLabelText('Continue'))
    })
    expect(getByText('Please enter a valid email address.')).toBeTruthy()
    expect(mockSendOtp).not.toHaveBeenCalled()
  })

  it('shows validation error after pressing Continue with empty email', async () => {
    const { getByLabelText, getByText } = render(<EnterEmailScreen />)
    await act(async () => {
      fireEvent.press(getByLabelText('Continue'))
    })
    expect(getByText('Please enter a valid email address.')).toBeTruthy()
    expect(mockSendOtp).not.toHaveBeenCalled()
  })
})

describe('EnterEmailScreen — OTP send', () => {
  it('calls useSendOtpMutation on Continue press with valid email', async () => {
    mockSendOtp.mockResolvedValueOnce({ message: 'sent' })
    const { getByLabelText } = render(<EnterEmailScreen />)
    fireEvent.changeText(getByLabelText('Email address'), 'user@example.com')
    await act(async () => {
      fireEvent.press(getByLabelText('Continue'))
    })
    expect(mockSendOtp).toHaveBeenCalledWith({ email: 'user@example.com' })
  })

  it('navigates to verify-code with email param on success', async () => {
    mockSendOtp.mockResolvedValueOnce({ message: 'sent' })
    const { getByLabelText } = render(<EnterEmailScreen />)
    fireEvent.changeText(getByLabelText('Email address'), 'user@example.com')
    await act(async () => {
      fireEvent.press(getByLabelText('Continue'))
    })
    expect(mockRouterPush).toHaveBeenCalledWith({
      pathname: '/(auth)/verify-code',
      params: { email: 'user@example.com' },
    })
  })

  it('shows error toast on network failure', async () => {
    mockSendOtp.mockRejectedValueOnce(new Error('Network error'))
    const { getByLabelText } = render(<EnterEmailScreen />)
    fireEvent.changeText(getByLabelText('Email address'), 'user@example.com')
    await act(async () => {
      fireEvent.press(getByLabelText('Continue'))
    })
    expect(mockShow).toHaveBeenCalledWith(
      'Connection Problem',
      expect.objectContaining({ message: expect.stringContaining('Network error') }),
    )
  })

  it('shows error toast on delivery failure', async () => {
    mockSendOtp.mockRejectedValueOnce(new Error('Unable to send verification email'))
    const { getByLabelText } = render(<EnterEmailScreen />)
    fireEvent.changeText(getByLabelText('Email address'), 'user@example.com')
    await act(async () => {
      fireEvent.press(getByLabelText('Continue'))
    })
    expect(mockShow).toHaveBeenCalledWith(
      'Email Not Sent',
      expect.objectContaining({ message: expect.stringContaining('verification email') }),
    )
  })

  it('shows generic "Error" toast for unknown OTP errors', async () => {
    mockSendOtp.mockRejectedValueOnce(new Error('Unexpected server error'))
    const { getByLabelText } = render(<EnterEmailScreen />)
    fireEvent.changeText(getByLabelText('Email address'), 'user@example.com')
    await act(async () => {
      fireEvent.press(getByLabelText('Continue'))
    })
    expect(mockShow).toHaveBeenCalledWith('Error', {
      message: 'Unexpected server error',
    })
  })

  it('shows generic "Error" toast when error is not an Error instance', async () => {
    mockSendOtp.mockRejectedValueOnce('string-error')
    const { getByLabelText } = render(<EnterEmailScreen />)
    fireEvent.changeText(getByLabelText('Email address'), 'user@example.com')
    await act(async () => {
      fireEvent.press(getByLabelText('Continue'))
    })
    expect(mockShow).toHaveBeenCalledWith('Error', {
      message: 'Something went wrong',
    })
  })
})

describe('EnterEmailScreen — Google Sign-In', () => {
  it('calls useGoogleSignInMutation on Google button press', async () => {
    mockGoogleMutateAsync.mockResolvedValue({ uid: 'user-1' })
    const { getByLabelText } = render(<EnterEmailScreen />)
    await act(async () => {
      fireEvent.press(getByLabelText('Continue with Google'))
    })
    expect(mockGoogleMutateAsync).toHaveBeenCalled()
  })

  it('shows error toast when Google Sign-In fails', async () => {
    mockGoogleMutateAsync.mockRejectedValue(new Error('Something went wrong'))
    const { getByLabelText } = render(<EnterEmailScreen />)
    await act(async () => {
      fireEvent.press(getByLabelText('Continue with Google'))
    })
    expect(mockShow).toHaveBeenCalledWith(
      'Sign-In Failed',
      expect.objectContaining({ message: 'Something went wrong. Please try again.' }),
    )
    expect(getByLabelText('Continue with Google').props.accessibilityState?.busy).toBe(false)
  })

  it('does not show error when cancelled (returns null)', async () => {
    mockGoogleMutateAsync.mockResolvedValue(null)
    const { getByLabelText } = render(<EnterEmailScreen />)
    await act(async () => {
      fireEvent.press(getByLabelText('Continue with Google'))
    })
    expect(mockShow).not.toHaveBeenCalled()
    expect(getByLabelText('Continue with Google').props.accessibilityState?.busy).toBe(false)
  })

  it('signs out stale Firebase user before Google sign-in when dbUser is null', async () => {
    // Simulate partial auth state: Firebase user exists but no DB record
    const mockFirebaseUser = { uid: 'stale-uid', email: 'stale@test.com' } as never
    useAuthStore.setState({ user: mockFirebaseUser, dbUser: null, isLoading: false })
    mockSignOut.mockResolvedValue(undefined)
    mockGoogleMutateAsync.mockResolvedValue({ uid: 'new-uid' })

    const { getByLabelText } = render(<EnterEmailScreen />)
    await act(async () => {
      fireEvent.press(getByLabelText('Continue with Google'))
    })

    expect(mockSignOut).toHaveBeenCalled()
    expect(mockGoogleMutateAsync).toHaveBeenCalled()
  })

  it('continues Google sign-in even when stale signOut fails', async () => {
    const mockFirebaseUser = { uid: 'stale-uid', email: 'stale@test.com' } as never
    useAuthStore.setState({ user: mockFirebaseUser, dbUser: null, isLoading: false })
    mockSignOut.mockRejectedValue(new Error('signOut failed'))
    mockGoogleMutateAsync.mockResolvedValue({ uid: 'new-uid' })

    const { getByLabelText } = render(<EnterEmailScreen />)
    await act(async () => {
      fireEvent.press(getByLabelText('Continue with Google'))
    })

    expect(mockSignOut).toHaveBeenCalled()
    expect(mockGoogleMutateAsync).toHaveBeenCalled()
  })

  it('shows spinner on Google button for the full sign-in duration (no gap)', async () => {
    let resolveSignIn!: (v: { uid: string }) => void
    mockGoogleMutateAsync.mockReturnValue(new Promise((r) => (resolveSignIn = r)))

    const { getByLabelText } = render(<EnterEmailScreen />)
    fireEvent.press(getByLabelText('Continue with Google'))

    // Spinner visible while Google SDK is running
    const button = getByLabelText('Continue with Google')
    expect(button.props.accessibilityState?.busy).toBe(true)

    // Simulate Google SDK done but server still syncing (isLoading: true)
    await act(async () => {
      resolveSignIn({ uid: 'user-1' })
      useAuthStore.setState({ isLoading: true })
    })
    expect(button.props.accessibilityState?.busy).toBe(true)

    // Server sync complete with user → isLoading false but user set → spinner stays (navigation imminent)
    await act(async () => {
      useAuthStore.setState({ isLoading: false, user: { uid: 'user-1' } as never })
    })
    expect(button.props.accessibilityState?.busy).toBe(true)

    // Sync failed → no user → spinner clears so user can retry
    await act(async () => {
      useAuthStore.setState({ isLoading: false, user: null })
    })
    expect(button.props.accessibilityState?.busy).toBe(false)
  })

  it('re-enables Google button when Firebase auth succeeded but server sync failed', async () => {
    mockGoogleMutateAsync.mockResolvedValue({ uid: 'user-1' })
    const mockFirebaseUser = { uid: 'user-1' } as never
    const { getByLabelText } = render(<EnterEmailScreen />)

    await act(async () => {
      fireEvent.press(getByLabelText('Continue with Google'))
    })

    // Firebase auth succeeded → user set, but sync failed → syncError set
    await act(async () => {
      useAuthStore.setState({
        isLoading: false,
        user: mockFirebaseUser,
        syncError: 'Account setup failed. Please try again.',
      })
    })

    expect(getByLabelText('Continue with Google').props.accessibilityState?.busy).toBe(false)
  })

  it('shows toast when syncError is set (register failed after sign-in)', () => {
    useAuthStore.setState({ syncError: 'Rate limit exceeded' })
    render(<EnterEmailScreen />)
    expect(mockShow).toHaveBeenCalledWith(
      'Account Setup Failed',
      expect.objectContaining({ message: 'Rate limit exceeded' }),
    )
  })
})
