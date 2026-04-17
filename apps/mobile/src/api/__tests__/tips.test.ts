import { describe, it, expect, vi, beforeEach } from 'vitest'
import { waitFor } from '@testing-library/react-native'
import { renderHookWithProviders } from '../../test/renderWithProviders'

vi.mock('../client', () => ({
  apiRequest: vi.fn(),
}))

import { apiRequest } from '../client'
import { useDailyTipQuery } from '../tips'

const mockApiRequest = vi.mocked(apiRequest)

beforeEach(() => {
  mockApiRequest.mockReset()
})

describe('useDailyTipQuery', () => {
  it('calls /v1/tips/daily and returns tip data', async () => {
    const tip = { tip: 'Take a short walk today.', category: 'Self Care' }
    mockApiRequest.mockResolvedValueOnce({ success: true, data: tip })

    const { result } = renderHookWithProviders(() => useDailyTipQuery())

    await waitFor(() => expect(result.current.data).toEqual(tip))
    expect(mockApiRequest).toHaveBeenCalledWith('/v1/tips/daily')
  })

  it('sets error when API returns success:false', async () => {
    mockApiRequest.mockResolvedValueOnce({ success: false, error: 'Server error' })

    const { result } = renderHookWithProviders(() => useDailyTipQuery())

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('Server error')
  })

  it('uses fallback error message when error field is undefined', async () => {
    // Simulate a malformed API response where error field is missing (e.g. proxy error)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockApiRequest.mockResolvedValueOnce({ success: false } as any)

    const { result } = renderHookWithProviders(() => useDailyTipQuery())

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('Failed to load daily tip')
  })

  it('uses staleTime to avoid excessive refetches', async () => {
    const tip = { tip: 'Stay hydrated.', category: 'Daily Care' }
    mockApiRequest.mockResolvedValue({ success: true, data: tip })

    const { result } = renderHookWithProviders(() => useDailyTipQuery())

    await waitFor(() => expect(result.current.data).toEqual(tip))
    // Only one call should have been made despite the query being rendered
    expect(mockApiRequest).toHaveBeenCalledTimes(1)
  })
})
