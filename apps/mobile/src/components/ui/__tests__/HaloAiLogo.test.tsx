import React, { forwardRef } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, act } from '../../../test/render'
import { HaloAiLogo, type HaloAiLogoRef } from '../HaloAiLogo'

const playMock = vi.fn()
const pauseMock = vi.fn()

vi.mock('lottie-react-native', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- vi.mock factory must use require
  const { View } = require('react-native')
  return {
    default: forwardRef((_props: Record<string, unknown>, ref: React.Ref<unknown>) => {
      React.useImperativeHandle(ref, () => ({ play: playMock, pause: pauseMock }))
      return <View testID="lottie-logo" />
    }),
  }
})

describe('HaloAiLogo', () => {
  beforeEach(() => {
    playMock.mockClear()
    pauseMock.mockClear()
  })

  it('renders the Lottie element', () => {
    const { getByTestId } = render(<HaloAiLogo />)

    expect(getByTestId('lottie-logo')).toBeTruthy()
  })

  it('does not auto-play when autoPlay is false', () => {
    render(<HaloAiLogo autoPlay={false} />)

    expect(playMock).not.toHaveBeenCalled()
  })

  it('calls play on mount when autoPlay is true', () => {
    render(<HaloAiLogo autoPlay />)

    expect(playMock).toHaveBeenCalledOnce()
  })

  it('exposes play() via forwarded ref', () => {
    const ref = React.createRef<HaloAiLogoRef>()
    render(<HaloAiLogo ref={ref} />)

    act(() => {
      ref.current?.play()
    })

    expect(playMock).toHaveBeenCalledOnce()
  })

  it('exposes pause() via forwarded ref', () => {
    const ref = React.createRef<HaloAiLogoRef>()
    render(<HaloAiLogo ref={ref} />)

    act(() => {
      ref.current?.pause()
    })

    expect(pauseMock).toHaveBeenCalledOnce()
  })
})
