import React, { forwardRef } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '../../../test/render'
import { IntroPager, type IntroSlideContent } from '../IntroPager'

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

function makeSlide(i: number): IntroSlideContent {
  return {
    source: {} as never,
    eyebrow: `eyebrow-${i}`,
    headline: `headline-${i}`,
    body: `body-${i}`,
  }
}

const SINGLE = [makeSlide(0)]
const THREE: IntroSlideContent[] = [makeSlide(0), makeSlide(1), makeSlide(2)]

let onFinish: ReturnType<typeof vi.fn>

beforeEach(() => {
  onFinish = vi.fn()
})

describe('IntroPager — CTA label', () => {
  it('reads "Get started" when the user is already on the last slide', () => {
    const { getByLabelText } = render(<IntroPager slides={SINGLE} onFinish={onFinish} />)
    expect(getByLabelText('Get started')).toBeTruthy()
  })

  it('reads "Continue" on the first of multiple slides', () => {
    const { getByLabelText } = render(<IntroPager slides={THREE} onFinish={onFinish} />)
    expect(getByLabelText('Continue')).toBeTruthy()
  })

  it('swaps to "Get started" after advancing to the last slide', () => {
    const { getByLabelText } = render(<IntroPager slides={THREE} onFinish={onFinish} />)
    fireEvent.press(getByLabelText('Continue'))
    fireEvent.press(getByLabelText('Continue'))
    expect(getByLabelText('Get started')).toBeTruthy()
  })
})

describe('IntroPager — exit paths', () => {
  it('invokes onFinish exactly once when Get Started is pressed on the last slide', () => {
    const { getByLabelText } = render(<IntroPager slides={SINGLE} onFinish={onFinish} />)
    fireEvent.press(getByLabelText('Get started'))
    expect(onFinish).toHaveBeenCalledOnce()
  })

  it('does not invoke onFinish while advancing between non-last slides', () => {
    const { getByLabelText } = render(<IntroPager slides={THREE} onFinish={onFinish} />)
    fireEvent.press(getByLabelText('Continue'))
    fireEvent.press(getByLabelText('Continue'))
    expect(onFinish).not.toHaveBeenCalled()
  })

  it('invokes onFinish when SKIP is tapped', () => {
    const { getByLabelText } = render(<IntroPager slides={THREE} onFinish={onFinish} />)
    fireEvent.press(getByLabelText('Skip introduction'))
    expect(onFinish).toHaveBeenCalledOnce()
  })
})
