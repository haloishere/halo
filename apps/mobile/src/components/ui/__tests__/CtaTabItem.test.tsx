import React, { forwardRef } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, act } from '../../../test/render'
import { CtaTabItem } from '../CtaTabItem'

const playMock = vi.fn()
const pauseMock = vi.fn()

vi.mock('lottie-react-native', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- vi.mock factory must use require
  const { View } = require('react-native')
  return {
    default: forwardRef((_props: Record<string, unknown>, ref: React.Ref<unknown>) => {
      React.useImperativeHandle(ref, () => ({ play: playMock, pause: pauseMock }))
      return <View testID="lottie-cta" />
    }),
  }
})

describe('CtaTabItem — Lottie playback', () => {
  beforeEach(() => {
    playMock.mockClear()
    pauseMock.mockClear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('pauses animation when focused', () => {
    render(<CtaTabItem label="Assistant" isFocused={true} onPress={vi.fn()} />)
    expect(pauseMock).toHaveBeenCalled()
    expect(playMock).not.toHaveBeenCalled()
  })

  it('plays animation immediately when not focused', () => {
    render(<CtaTabItem label="Assistant" isFocused={false} onPress={vi.fn()} />)
    expect(playMock).toHaveBeenCalledTimes(1)
    expect(pauseMock).not.toHaveBeenCalled()
  })

  it('re-plays every 15 seconds when not focused', () => {
    render(<CtaTabItem label="Assistant" isFocused={false} onPress={vi.fn()} />)
    expect(playMock).toHaveBeenCalledTimes(1) // immediate

    act(() => { vi.advanceTimersByTime(15_000) })
    expect(playMock).toHaveBeenCalledTimes(2)

    act(() => { vi.advanceTimersByTime(15_000) })
    expect(playMock).toHaveBeenCalledTimes(3)
  })

  it('pauses and stops interval when tab becomes focused', () => {
    const { rerender } = render(<CtaTabItem label="Assistant" isFocused={false} onPress={vi.fn()} />)
    expect(playMock).toHaveBeenCalledTimes(1)

    act(() => {
      rerender(<CtaTabItem label="Assistant" isFocused={true} onPress={vi.fn()} />)
    })
    expect(pauseMock).toHaveBeenCalledTimes(1)

    // interval must be cleared — no more plays after 15 s
    act(() => { vi.advanceTimersByTime(15_000) })
    expect(playMock).toHaveBeenCalledTimes(1)
  })

  it('restarts interval when focus is lost again', () => {
    const { rerender } = render(<CtaTabItem label="Assistant" isFocused={true} onPress={vi.fn()} />)
    playMock.mockClear()

    act(() => {
      rerender(<CtaTabItem label="Assistant" isFocused={false} onPress={vi.fn()} />)
    })
    expect(playMock).toHaveBeenCalledTimes(1) // immediate on blur

    act(() => { vi.advanceTimersByTime(15_000) })
    expect(playMock).toHaveBeenCalledTimes(2) // interval fires
  })

  it('calls onPress when tapped', () => {
    const onPress = vi.fn()
    const { getByLabelText } = render(<CtaTabItem label="Assistant" isFocused={false} onPress={onPress} />)
    fireEvent.press(getByLabelText('Assistant'))
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('renders Lottie animation', () => {
    const { getByTestId } = render(<CtaTabItem label="Assistant" isFocused={false} onPress={vi.fn()} />)
    expect(getByTestId('lottie-cta')).toBeTruthy()
  })
})
