import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '../../../test/render'

vi.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
}))

vi.mock('lottie-react-native', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- vi.mock factory must use require
  const { View } = require('react-native')
  return {
    default: React.forwardRef((props: Record<string, unknown>, _ref: unknown) => (
      <View testID="lottie-avatar" {...props} />
    )),
  }
})

// ─── Clock pinning ─────────────────────────────────────────────────────────
// The chat-greeting helper reads the device's local time to pick the bucket.
// To make rendering deterministic, fix the system clock before each render
// and restore real timers after. Boundary semantics of `getTimeOfDay` are
// covered exhaustively in chat-greeting.test.ts — here we only lock that
// WelcomeGreeting renders the helper's output verbatim in the UI.

function at(hours: number): Date {
  // May 15 2026, local timezone. matches chat-greeting.test.ts helper.
  return new Date(2026, 4, 15, hours, 0, 0, 0)
}

import { WelcomeGreeting } from '../WelcomeGreeting'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('WelcomeGreeting — time-of-day rendering', () => {
  it('renders "Good morning, Amir" and the morning subtitle at 08:00', () => {
    vi.setSystemTime(at(8))
    const { getByText } = render(<WelcomeGreeting displayName="Amir Jalali" />)

    expect(getByText('Good morning, Amir')).toBeTruthy()
    expect(getByText("Take your time. I'm here.")).toBeTruthy()
  })

  it('renders the afternoon greeting at 14:00', () => {
    vi.setSystemTime(at(14))
    const { getByText } = render(<WelcomeGreeting displayName="Amir" />)

    expect(getByText('Good afternoon, Amir')).toBeTruthy()
    expect(getByText("What's on your mind?")).toBeTruthy()
  })

  it('renders the evening greeting at 19:00', () => {
    vi.setSystemTime(at(19))
    const { getByText } = render(<WelcomeGreeting displayName="Amir" />)

    expect(getByText('Good evening, Amir')).toBeTruthy()
    expect(getByText('How was your day?')).toBeTruthy()
  })

  it('renders the late-night greeting at 02:00', () => {
    vi.setSystemTime(at(2))
    const { getByText } = render(<WelcomeGreeting displayName="Amir" />)

    expect(getByText('Hi, Amir')).toBeTruthy()
    expect(getByText("It's okay to be awake. I'm here.")).toBeTruthy()
  })
})

describe('WelcomeGreeting — displayName fallback', () => {
  it('falls back to "there" when displayName is null (logged-out / pre-sync)', () => {
    vi.setSystemTime(at(8))
    const { getByText } = render(<WelcomeGreeting displayName={null} />)

    expect(getByText('Good morning, there')).toBeTruthy()
  })

  it('falls back to "there" when displayName is undefined', () => {
    vi.setSystemTime(at(8))
    const { getByText } = render(<WelcomeGreeting displayName={undefined} />)

    expect(getByText('Good morning, there')).toBeTruthy()
  })

  it('falls back to "there" for whitespace-only displayName', () => {
    vi.setSystemTime(at(8))
    const { getByText } = render(<WelcomeGreeting displayName="   " />)

    expect(getByText('Good morning, there')).toBeTruthy()
  })

  it('uses only the first name from a multi-word displayName', () => {
    vi.setSystemTime(at(8))
    const { getByText, queryByText } = render(<WelcomeGreeting displayName="Amir Reza Jalali" />)

    expect(getByText('Good morning, Amir')).toBeTruthy()
    // Regression lock: must NOT render the full name.
    expect(queryByText(/Reza/)).toBeNull()
    expect(queryByText(/Jalali/)).toBeNull()
  })
})

describe('WelcomeGreeting — Lottie avatar', () => {
  it('renders the LottieView avatar above the greeting', () => {
    vi.setSystemTime(at(8))
    const { getByTestId } = render(<WelcomeGreeting displayName="Amir" />)

    expect(getByTestId('lottie-avatar', { includeHiddenElements: true })).toBeTruthy()
  })

  it('renders the avatar regardless of displayName fallback', () => {
    vi.setSystemTime(at(8))
    const { getByTestId } = render(<WelcomeGreeting displayName={null} />)

    expect(getByTestId('lottie-avatar', { includeHiddenElements: true })).toBeTruthy()
  })

  it('animates when focused and reduce motion is off', () => {
    vi.setSystemTime(at(8))
    const { getByTestId } = render(<WelcomeGreeting displayName="Amir" />)

    // useIsFocused → true, useReducedMotion → false (both mocked above)
    const avatar = getByTestId('lottie-avatar', { includeHiddenElements: true })
    expect(avatar.props.autoPlay).toBe(true)
    expect(avatar.props.loop).toBe(true)
  })

  it('is hidden from screen readers (decorative)', () => {
    vi.setSystemTime(at(8))
    const { getByTestId } = render(<WelcomeGreeting displayName="Amir" />)

    const wrapper = getByTestId('lottie-avatar-wrapper', { includeHiddenElements: true })
    expect(wrapper.props.accessible).toBe(false)
    expect(wrapper.props.importantForAccessibility).toBe('no-hide-descendants')
  })

  it('passes a non-empty source object to LottieView', () => {
    vi.setSystemTime(at(8))
    const { getByTestId } = render(<WelcomeGreeting displayName="Amir" />)

    const avatar = getByTestId('lottie-avatar', { includeHiddenElements: true })
    expect(avatar.props.source).toBeTruthy()
    expect(typeof avatar.props.source).toBe('object')
  })
})
