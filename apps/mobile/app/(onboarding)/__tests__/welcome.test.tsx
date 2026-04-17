import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
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
  it('pushes to relationship screen with trimmed name', () => {
    const { getByLabelText } = render(<WelcomeScreen />)
    fireEvent.changeText(getByLabelText('Your name'), '  Alice  ')
    fireEvent.press(getByLabelText('Continue'))
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(onboarding)/relationship',
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
