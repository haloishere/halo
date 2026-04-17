import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render } from '../../../test/render'

const mockToastState = vi.fn()
const mockHide = vi.fn()

vi.mock('@tamagui/toast', () => ({
  useToastState: () => mockToastState(),
  useToastController: () => ({ show: vi.fn(), hide: mockHide, nativeToast: vi.fn() }),
}))

import { CurrentToast } from '../CurrentToast'

describe('CurrentToast — rendering', () => {
  it('returns null when no toast is active', () => {
    mockToastState.mockReturnValue(null)
    const { queryByRole } = render(<CurrentToast />)
    expect(queryByRole('alert')).toBeNull()
  })

  it('returns null when toast is handled natively', () => {
    mockToastState.mockReturnValue({ id: '1', isHandledNatively: true })
    const { queryByRole } = render(<CurrentToast />)
    expect(queryByRole('alert')).toBeNull()
  })

  it('renders title when toast is active', () => {
    mockToastState.mockReturnValue({
      id: '1',
      title: 'Test Title',
      isHandledNatively: false,
      duration: 4000,
    })
    const { getByText } = render(<CurrentToast />)
    expect(getByText('Test Title')).toBeTruthy()
  })

  it('renders description when message is provided', () => {
    mockToastState.mockReturnValue({
      id: '1',
      title: 'Title',
      message: 'Description text',
      isHandledNatively: false,
      duration: 4000,
    })
    const { getByText } = render(<CurrentToast />)
    expect(getByText('Description text')).toBeTruthy()
  })

  it('does not render description when no message', () => {
    mockToastState.mockReturnValue({
      id: '1',
      title: 'Title Only',
      isHandledNatively: false,
      duration: 4000,
    })
    const { queryByText } = render(<CurrentToast />)
    expect(queryByText('Description text')).toBeNull()
  })
})

describe('CurrentToast — accessibility', () => {
  it('has accessibilityRole alert on the toast container', () => {
    mockToastState.mockReturnValue({
      id: '1',
      title: 'A11y test',
      isHandledNatively: false,
      duration: 4000,
    })
    const { getByRole } = render(<CurrentToast />)
    expect(getByRole('alert')).toBeTruthy()
  })

  it('has accessibilityLiveRegion polite for screen reader announcements', () => {
    mockToastState.mockReturnValue({
      id: '1',
      title: 'Live region test',
      isHandledNatively: false,
      duration: 4000,
    })
    const { getByRole } = render(<CurrentToast />)
    const alert = getByRole('alert')
    expect(alert.props.accessibilityLiveRegion).toBe('polite')
  })
})

describe('CurrentToast — auto-dismiss', () => {
  it('calls hide after duration', () => {
    vi.useFakeTimers()
    mockHide.mockClear()
    mockToastState.mockReturnValue({
      id: '1',
      title: 'Auto dismiss',
      isHandledNatively: false,
      duration: 2000,
    })
    render(<CurrentToast />)
    expect(mockHide).not.toHaveBeenCalled()
    vi.advanceTimersByTime(2000)
    expect(mockHide).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('uses default 4000ms when no duration', () => {
    vi.useFakeTimers()
    mockHide.mockClear()
    mockToastState.mockReturnValue({
      id: '2',
      title: 'Default duration',
      isHandledNatively: false,
    })
    render(<CurrentToast />)
    vi.advanceTimersByTime(3999)
    expect(mockHide).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(mockHide).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('cancels previous timer when toast changes', () => {
    vi.useFakeTimers()
    mockHide.mockClear()
    mockToastState.mockReturnValue({
      id: '1',
      title: 'First',
      isHandledNatively: false,
      duration: 5000,
    })
    const { rerender } = render(<CurrentToast />)

    vi.advanceTimersByTime(2000)
    mockToastState.mockReturnValue({
      id: '2',
      title: 'Second',
      isHandledNatively: false,
      duration: 3000,
    })
    rerender(<CurrentToast />)

    vi.advanceTimersByTime(3000)
    expect(mockHide).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(3000)
    expect(mockHide).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('does not call hide after toast becomes null', () => {
    vi.useFakeTimers()
    mockHide.mockClear()
    mockToastState.mockReturnValue({
      id: '1',
      title: 'Will disappear',
      isHandledNatively: false,
      duration: 5000,
    })
    const { rerender } = render(<CurrentToast />)

    vi.advanceTimersByTime(1000)
    mockToastState.mockReturnValue(null)
    rerender(<CurrentToast />)

    vi.advanceTimersByTime(5000)
    expect(mockHide).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})
