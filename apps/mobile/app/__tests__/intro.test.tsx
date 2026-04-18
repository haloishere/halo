import React, { forwardRef } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '../../src/test/render'
import { useIntroStore } from '../../src/stores/intro'

const { replaceMock } = vi.hoisted(() => ({ replaceMock: vi.fn() }))

vi.mock('expo-router', () => ({
  router: { replace: replaceMock },
}))

vi.mock('lottie-react-native', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- vi.mock factory must use require
  const { View } = require('react-native')
  return {
    default: forwardRef((_props: Record<string, unknown>, ref: React.Ref<unknown>) => {
      React.useImperativeHandle(ref, () => ({
        play: () => {},
        pause: () => {},
        reset: () => {},
      }))
      return <View testID="lottie" />
    }),
  }
})

import IntroScreen from '../intro'

beforeEach(() => {
  replaceMock.mockReset()
  useIntroStore.setState({ hasSeen: false, hydrated: false }, false)
})

describe('IntroScreen — finish flow', () => {
  // The order matters: if router.replace('/') fires before markSeen(),
  // `app/index.tsx` re-reads hasSeen = false and redirects right back to
  // /intro, locking the user in a loop.
  it('marks intro as seen before navigating away', () => {
    const { getByLabelText } = render(<IntroScreen />)

    fireEvent.press(getByLabelText('Skip introduction'))

    expect(useIntroStore.getState().hasSeen).toBe(true)
    expect(replaceMock).toHaveBeenCalledWith('/')
  })

  it('navigates to the root router when Skip is pressed', () => {
    const { getByLabelText } = render(<IntroScreen />)

    fireEvent.press(getByLabelText('Skip introduction'))

    expect(replaceMock).toHaveBeenCalledTimes(1)
    expect(replaceMock).toHaveBeenCalledWith('/')
  })
})
