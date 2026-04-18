import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, waitFor } from '@testing-library/react-native'
import { renderHookWithProviders } from '../../test/renderWithProviders'
import { makeUserProfile } from '../../test/fixtures'

vi.mock('../client', () => ({
  apiRequest: vi.fn(),
}))

import { apiRequest } from '../client'
import { useProfileQuery, useOnboardingMutation } from '../users'

const mockApiRequest = vi.mocked(apiRequest)

beforeEach(() => {
  mockApiRequest.mockReset()
})

describe('useProfileQuery', () => {
  it('calls /v1/users/me and returns profile', async () => {
    const profile = makeUserProfile()
    mockApiRequest.mockResolvedValueOnce({ success: true, data: profile })

    const { result } = renderHookWithProviders(() => useProfileQuery())

    await waitFor(() => expect(result.current.data).toEqual(profile))
    expect(mockApiRequest).toHaveBeenCalledWith('/v1/users/me')
  })

  it('sets error when response.success is false', async () => {
    mockApiRequest.mockResolvedValueOnce({ success: false, error: 'Unauthorized' })

    const { result } = renderHookWithProviders(() => useProfileQuery())

    // React Query may take multiple async ticks to transition from pending → error;
    // use waitFor instead of a single setTimeout tick.
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('useOnboardingMutation', () => {
  it('calls /v1/users/me/onboarding with POST', async () => {
    const profile = makeUserProfile()
    mockApiRequest.mockResolvedValueOnce({ success: true, data: profile })

    const { result } = renderHookWithProviders(() => useOnboardingMutation())
    const payload = { displayName: 'Jane', city: 'Luzern' }

    await act(async () => {
      await result.current.mutateAsync(payload)
    })

    expect(mockApiRequest).toHaveBeenCalledWith('/v1/users/me/onboarding', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  })
})
