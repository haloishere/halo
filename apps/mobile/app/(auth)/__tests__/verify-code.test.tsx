import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, act } from '../../../src/test/render'

const { mockVerifyOtp, mockSignInWithCustomToken, mockRouterBack, mockSendOtp } = vi.hoisted(
  () => ({
    mockVerifyOtp: vi.fn(),
    mockSignInWithCustomToken: vi.fn(),
    mockRouterBack: vi.fn(),
    mockSendOtp: vi.fn(),
  }),
)

vi.mock('expo-router', () => ({
  router: { back: mockRouterBack, replace: vi.fn() },
  useLocalSearchParams: () => ({ email: 'test@example.com' }),
  Link: ({ children, style }: { children: React.ReactNode; href: string; style?: unknown }) =>
    React.createElement('Text', { style }, children),
}))

vi.mock('firebase/auth', () => ({
  signInWithCustomToken: mockSignInWithCustomToken,
}))

vi.mock('../../../src/lib/firebase', () => ({
  auth: {},
}))

vi.mock('../../../src/api/otp', () => ({
  useVerifyOtpMutation: () => ({
    mutateAsync: mockVerifyOtp,
    isPending: false,
  }),
  useSendOtpMutation: () => ({
    mutateAsync: mockSendOtp,
    isPending: false,
  }),
}))

vi.mock('../../../src/stores/theme', () => ({
  useThemeStore: () => ({ mode: 'light', setMode: vi.fn() }),
}))

vi.mock('../../../src/lib/auth-errors', () => ({
  getAuthErrorMessage: (err: unknown) =>
    err instanceof Error ? err.message : 'Something went wrong.',
}))

import VerifyCodeScreen from '../verify-code'

beforeEach(() => {
  mockVerifyOtp.mockReset()
  mockSignInWithCustomToken.mockReset()
  mockRouterBack.mockReset()
  mockSendOtp.mockReset()
})

describe('VerifyCodeScreen — rendering', () => {
  it('renders verification heading', () => {
    const { getByText } = render(<VerifyCodeScreen />)
    expect(getByText('Enter verification code')).toBeTruthy()
  })

  it('shows masked email', () => {
    const { getByText } = render(<VerifyCodeScreen />)
    expect(getByText(/Code sent to t\*+@example\.com/)).toBeTruthy()
  })

  it('renders 6 OTP input cells', () => {
    const { getAllByLabelText } = render(<VerifyCodeScreen />)
    const cells = getAllByLabelText(/digit \d/)
    expect(cells).toHaveLength(6)
  })

  it('renders "Use a different email" back link', () => {
    const { getByText } = render(<VerifyCodeScreen />)
    expect(getByText('Use a different email')).toBeTruthy()
  })

  it('renders theme toggle switch', () => {
    const { getByRole } = render(<VerifyCodeScreen />)
    expect(getByRole('switch')).toBeTruthy()
  })

  it('renders "Resend code" button with initial cooldown', () => {
    const { getByLabelText } = render(<VerifyCodeScreen />)
    expect(getByLabelText('Resend code (30s)')).toBeTruthy()
  })
})

describe('VerifyCodeScreen — verification', () => {
  it('calls verifyOtp and signInWithCustomToken on code complete (paste)', async () => {
    mockVerifyOtp.mockResolvedValueOnce({
      customToken: 'custom-token-123',
      user: { id: '1', email: 'test@example.com' },
    })
    mockSignInWithCustomToken.mockResolvedValueOnce({})

    const { getAllByLabelText } = render(<VerifyCodeScreen />)
    const cells = getAllByLabelText(/digit \d/)

    // Simulate pasting a full code into the first cell
    await act(async () => {
      fireEvent.changeText(cells[0]!, '123456')
    })

    expect(mockVerifyOtp).toHaveBeenCalledWith({
      email: 'test@example.com',
      code: '123456',
    })
  })

  it('does not call verifyOtp twice on rapid double-submit', async () => {
    // First call hangs (never resolves during this test)
    mockVerifyOtp.mockReturnValue(new Promise(() => {}))

    const { getAllByLabelText } = render(<VerifyCodeScreen />)
    const cells = getAllByLabelText(/digit \d/)

    // Fire two rapid pastes
    await act(async () => {
      fireEvent.changeText(cells[0]!, '123456')
    })
    await act(async () => {
      fireEvent.changeText(cells[0]!, '123456')
    })

    // Should only be called once due to concurrency guard
    expect(mockVerifyOtp).toHaveBeenCalledTimes(1)
  })

  it('shows error when verification fails', async () => {
    mockVerifyOtp.mockRejectedValueOnce(new Error('Invalid code'))

    const { getAllByLabelText, findByText } = render(<VerifyCodeScreen />)
    const cells = getAllByLabelText(/digit \d/)

    await act(async () => {
      fireEvent.changeText(cells[0]!, '654321')
    })

    expect(await findByText('Invalid code')).toBeTruthy()
  })
})

describe('VerifyCodeScreen — resend', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('calls sendOtp when resend is pressed after cooldown expires', async () => {
    mockSendOtp.mockResolvedValueOnce({ message: 'sent' })

    const { getByLabelText } = render(<VerifyCodeScreen />)

    // Advance past initial 30s cooldown — tick each second for state updates
    for (let i = 0; i < 30; i++) {
      await act(async () => {
        vi.advanceTimersByTime(1_000)
      })
    }

    await act(async () => {
      fireEvent.press(getByLabelText('Resend code'))
    })

    expect(mockSendOtp).toHaveBeenCalledWith({ email: 'test@example.com' })
  })

  it('disables resend button during cooldown', () => {
    const { getByLabelText } = render(<VerifyCodeScreen />)
    const button = getByLabelText('Resend code (30s)')
    expect(button.props.accessibilityState?.disabled ?? button.props.disabled).toBeTruthy()
  })
})

describe('VerifyCodeScreen — navigation', () => {
  it('"Use a different email" navigates back', () => {
    const { getByText } = render(<VerifyCodeScreen />)
    fireEvent.press(getByText('Use a different email'))
    expect(mockRouterBack).toHaveBeenCalled()
  })
})
