import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react-native'
import { useReadingProgress } from './useReadingProgress'

const mockMutate = vi.fn()

vi.mock('../api/content', () => ({
  useUpdateProgress: () => ({ mutate: mockMutate }),
}))

beforeEach(() => {
  mockMutate.mockReset()
})

describe('useReadingProgress', () => {
  it('returns initial progress', () => {
    const { result } = renderHook(() => useReadingProgress('item-1', 25))
    expect(result.current.progress).toBe(25)
  })

  it('updates progress on scroll', () => {
    const { result } = renderHook(() => useReadingProgress('item-1', 0))

    act(() => {
      result.current.onScroll({
        nativeEvent: {
          contentOffset: { y: 500 },
          contentSize: { height: 2000 },
          layoutMeasurement: { height: 500 },
        },
      })
    })

    // 500 / (2000 - 500) = ~33%
    expect(result.current.progress).toBeGreaterThanOrEqual(30)
  })

  it('does not decrease progress', () => {
    const { result } = renderHook(() => useReadingProgress('item-1', 50))

    act(() => {
      result.current.onScroll({
        nativeEvent: {
          contentOffset: { y: 100 },
          contentSize: { height: 2000 },
          layoutMeasurement: { height: 500 },
        },
      })
    })

    expect(result.current.progress).toBe(50)
  })

  it('does not call mutate when below save threshold (10%)', () => {
    const { result } = renderHook(() => useReadingProgress('item-1', 0))

    act(() => {
      result.current.onScroll({
        nativeEvent: {
          contentOffset: { y: 50 },
          contentSize: { height: 2000 },
          layoutMeasurement: { height: 500 },
        },
      })
    })

    // ~3% scroll — below 10% threshold
    expect(mockMutate).not.toHaveBeenCalled()
  })

  it('calls mutate when threshold reached (>= 10%)', () => {
    const { result } = renderHook(() => useReadingProgress('item-1', 0))

    act(() => {
      result.current.onScroll({
        nativeEvent: {
          contentOffset: { y: 200 },
          contentSize: { height: 2000 },
          layoutMeasurement: { height: 500 },
        },
      })
    })

    // ~13% scroll — above 10% threshold
    expect(mockMutate).toHaveBeenCalledOnce()
    expect(mockMutate).toHaveBeenCalledWith(
      { contentItemId: 'item-1', progressPercent: expect.any(Number) },
      expect.objectContaining({ onError: expect.any(Function) }),
    )
  })

  it('calls mutate on 100% completion', () => {
    const { result } = renderHook(() => useReadingProgress('item-1', 95))

    act(() => {
      result.current.onScroll({
        nativeEvent: {
          contentOffset: { y: 1500 },
          contentSize: { height: 2000 },
          layoutMeasurement: { height: 500 },
        },
      })
    })

    expect(mockMutate).toHaveBeenCalledOnce()
  })

  it('syncs progress when initialProgress changes (article loads async)', () => {
    let initialProgress = 0
    const { result, rerender } = renderHook(() => useReadingProgress('item-1', initialProgress))

    expect(result.current.progress).toBe(0)

    // Simulate article loading with existing progress
    initialProgress = 60
    rerender(undefined)

    expect(result.current.progress).toBe(60)
  })

  it('does not call mutate when contentItemId is empty', () => {
    const { result } = renderHook(() => useReadingProgress('', 0))

    act(() => {
      result.current.onScroll({
        nativeEvent: {
          contentOffset: { y: 500 },
          contentSize: { height: 2000 },
          layoutMeasurement: { height: 500 },
        },
      })
    })

    expect(mockMutate).not.toHaveBeenCalled()
  })
})
