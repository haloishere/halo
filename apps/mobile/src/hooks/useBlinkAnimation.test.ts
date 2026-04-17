import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react-native'
import { cancelAnimation } from 'react-native-reanimated'
import { useBlinkAnimation } from './useBlinkAnimation'

describe('useBlinkAnimation', () => {
  it('returns an animated style object', () => {
    const { result } = renderHook(() => useBlinkAnimation(0.25, 550))

    expect(result.current).toBeDefined()
    expect(typeof result.current).toBe('object')
  })

  it('returns a style with an opacity value', () => {
    const { result } = renderHook(() => useBlinkAnimation(0.25, 550))

    expect('opacity' in result.current).toBe(true)
  })

  it('cancels the animation worklet on unmount', () => {
    vi.mocked(cancelAnimation).mockClear()
    const { unmount } = renderHook(() => useBlinkAnimation(0.25, 550))

    expect(vi.mocked(cancelAnimation)).not.toHaveBeenCalled()

    unmount()

    expect(vi.mocked(cancelAnimation)).toHaveBeenCalledOnce()
  })

  it('cancels previous animation when params change', () => {
    vi.mocked(cancelAnimation).mockClear()
    const { rerender } = renderHook(
      ({ min, dur }: { min: number; dur: number }) => useBlinkAnimation(min, dur),
      { initialProps: { min: 0.25, dur: 550 } },
    )

    rerender({ min: 0.1, dur: 300 })

    // cleanup of the first effect fires before the second effect runs
    expect(vi.mocked(cancelAnimation)).toHaveBeenCalledOnce()
  })
})
