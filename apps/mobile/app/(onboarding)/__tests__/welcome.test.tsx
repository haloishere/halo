import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent } from '../../../src/test/render'

const { mockPush } = vi.hoisted(() => ({ mockPush: vi.fn() }))

vi.mock('expo-router', () => ({
  router: { push: mockPush },
  useLocalSearchParams: vi.fn().mockReturnValue({}),
}))

import { useLocalSearchParams } from 'expo-router'
import WelcomeScreen from '../welcome'

const mockUseParams = vi.mocked(useLocalSearchParams)

beforeEach(() => {
  mockPush.mockReset()
  mockUseParams.mockReturnValue({} as ReturnType<typeof useLocalSearchParams>)
})

describe('WelcomeScreen — rendering', () => {
  it('renders name input', () => {
    const { getByLabelText } = render(<WelcomeScreen />)
    expect(getByLabelText('Your name')).toBeTruthy()
  })

  it('Continue button disabled when name is empty', () => {
    const { getByLabelText } = render(<WelcomeScreen />)
    expect(getByLabelText('Continue').props.accessibilityState?.disabled).toBe(true)
  })

  it('enables Continue button when name entered', () => {
    const { getByLabelText } = render(<WelcomeScreen />)
    fireEvent.changeText(getByLabelText('Your name'), 'Alice')
    expect(getByLabelText('Continue').props.accessibilityState?.disabled).toBe(false)
  })
})

describe('WelcomeScreen — navigation', () => {
  it('pushes to city screen with trimmed name', () => {
    const { getByLabelText } = render(<WelcomeScreen />)
    fireEvent.changeText(getByLabelText('Your name'), '  Alice  ')
    fireEvent.press(getByLabelText('Continue'))
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(onboarding)/city',
      params: { name: 'Alice' },
    })
  })

  it('does not navigate when name is whitespace only', () => {
    const { getByLabelText } = render(<WelcomeScreen />)
    fireEvent.changeText(getByLabelText('Your name'), '   ')
    fireEvent.press(getByLabelText('Continue'))
    expect(mockPush).not.toHaveBeenCalled()
  })
})

describe('WelcomeScreen — name validation', () => {
  it('keeps Continue disabled when name contains invalid characters', () => {
    const { getByLabelText } = render(<WelcomeScreen />)
    fireEvent.changeText(getByLabelText('Your name'), '<script>')
    expect(getByLabelText('Continue').props.accessibilityState?.disabled).toBe(true)
  })

  it('shows error message for invalid characters after typing', () => {
    const { getByLabelText, getByText } = render(<WelcomeScreen />)
    fireEvent.changeText(getByLabelText('Your name'), 'Test<>')
    expect(getByText(/letters, spaces, hyphens, apostrophes, and periods/)).toBeTruthy()
  })

  it('does not show error message on initial empty state', () => {
    const { queryByText } = render(<WelcomeScreen />)
    expect(queryByText(/letters, spaces, hyphens, apostrophes, and periods/)).toBeNull()
  })

  it("allows names with apostrophes (O'Brien)", () => {
    const { getByLabelText } = render(<WelcomeScreen />)
    fireEvent.changeText(getByLabelText('Your name'), "O'Brien")
    expect(getByLabelText('Continue').props.accessibilityState?.disabled).toBe(false)
  })

  it('allows names with hyphens (Anne-Marie)', () => {
    const { getByLabelText } = render(<WelcomeScreen />)
    fireEvent.changeText(getByLabelText('Your name'), 'Anne-Marie')
    expect(getByLabelText('Continue').props.accessibilityState?.disabled).toBe(false)
  })

  it('allows Unicode names', () => {
    const { getByLabelText } = render(<WelcomeScreen />)
    fireEvent.changeText(getByLabelText('Your name'), 'María')
    expect(getByLabelText('Continue').props.accessibilityState?.disabled).toBe(false)
  })

  it('does not navigate when name has invalid characters', () => {
    const { getByLabelText } = render(<WelcomeScreen />)
    fireEvent.changeText(getByLabelText('Your name'), 'Test123')
    fireEvent.press(getByLabelText('Continue'))
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('enforces max length of 100 characters on input', () => {
    const { getByLabelText } = render(<WelcomeScreen />)
    expect(getByLabelText('Your name').props.maxLength).toBe(100)
  })
})

describe('WelcomeScreen — pre-fill from params', () => {
  it('pre-fills name input from route params', () => {
    mockUseParams.mockReturnValue({ name: 'Bob' } as ReturnType<typeof useLocalSearchParams>)
    const { getByLabelText } = render(<WelcomeScreen />)
    expect(getByLabelText('Your name').props.value).toBe('Bob')
  })
})

describe('WelcomeScreen — pre-fill from Firebase displayName', () => {
  // These tests mock the auth store in-line (not at module scope) because the
  // other 14 tests in this file rely on the default store state (user: null).
  // A top-level mock would cascade. Cleanup lives in afterEach so it runs even
  // if an assertion throws mid-test.
  function mockStoreWithUser(displayName: string | null) {
    vi.resetModules()
    vi.doMock('../../../src/stores/auth', () => ({
      useAuthStore: (selector?: (s: unknown) => unknown) => {
        const state = { user: { displayName } }
        return selector ? selector(state) : state
      },
    }))
  }

  afterEach(() => {
    vi.doUnmock('../../../src/stores/auth')
    vi.resetModules()
  })

  it('pre-fills first name from Firebase displayName when params are empty', async () => {
    mockStoreWithUser('Maria Gonzalez')
    const { default: WelcomeScreenWithStore } = await import('../welcome')
    const { getByLabelText } = render(<WelcomeScreenWithStore />)
    expect(getByLabelText('Your name').props.value).toBe('Maria')
  })

  it('params.name wins over Firebase displayName', async () => {
    mockUseParams.mockReturnValue({ name: 'Bob' } as ReturnType<typeof useLocalSearchParams>)
    mockStoreWithUser('Maria Gonzalez')
    const { default: WelcomeScreenWithStore } = await import('../welcome')
    const { getByLabelText } = render(<WelcomeScreenWithStore />)
    expect(getByLabelText('Your name').props.value).toBe('Bob')
  })

  // Regression lock: OTP users (and Apple users who declined name sharing) land
  // on welcome with `firebaseUser.displayName === null`. Prefill must degrade
  // silently to an empty field — not crash, not show "null", not show "undefined".
  it('leaves the name input empty when Firebase displayName is null', async () => {
    mockStoreWithUser(null)
    const { default: WelcomeScreenWithStore } = await import('../welcome')
    const { getByLabelText } = render(<WelcomeScreenWithStore />)
    expect(getByLabelText('Your name').props.value).toBe('')
  })
})
