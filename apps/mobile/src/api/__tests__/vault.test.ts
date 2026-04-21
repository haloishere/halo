import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, waitFor } from '@testing-library/react-native'
import { renderHookWithProviders } from '../../test/renderWithProviders'

vi.mock('../client', () => ({
  apiRequest: vi.fn(),
}))

import { apiRequest } from '../client'
import {
  useVaultEntriesQuery,
  useDeleteVaultEntryMutation,
  useCreateVaultEntryMutation,
} from '../vault'

const mockApiRequest = vi.mocked(apiRequest)

const FASHION_RECORD = {
  id: '11111111-1111-1111-1111-111111111111',
  userId: '22222222-2222-2222-2222-222222222222',
  type: 'preference' as const,
  topic: 'fashion' as const,
  content: {
    category: 'lifestyle' as const,
    subject: 'minimalist',
    sentiment: 'likes' as const,
    confidence: 0.9,
  },
  createdAt: '2026-04-21T10:00:00.000Z',
  updatedAt: '2026-04-21T10:00:00.000Z',
  deletedAt: null,
}

beforeEach(() => {
  mockApiRequest.mockReset()
})

describe('useVaultEntriesQuery', () => {
  it('hits GET /v1/vault/entries?topic=<topic> and returns the list', async () => {
    mockApiRequest.mockResolvedValueOnce({ success: true, data: [FASHION_RECORD] })

    const { result } = renderHookWithProviders(() =>
      useVaultEntriesQuery({ topic: 'fashion' }),
    )

    await waitFor(() => expect(result.current.data).toEqual([FASHION_RECORD]))
    expect(mockApiRequest).toHaveBeenCalledWith('/v1/vault/entries?topic=fashion')
  })

  it('surfaces an error when the response envelope says success: false', async () => {
    mockApiRequest.mockResolvedValueOnce({ success: false, error: 'Unauthorized' })

    const { result } = renderHookWithProviders(() =>
      useVaultEntriesQuery({ topic: 'fashion' }),
    )

    await waitFor(() => expect(result.current.isError).toBe(true))
  })

  it('uses a topic-scoped queryKey so two topics cache independently', async () => {
    mockApiRequest.mockResolvedValue({ success: true, data: [] })

    const { result: food } = renderHookWithProviders(() =>
      useVaultEntriesQuery({ topic: 'food_and_restaurants' }),
    )
    const { result: fashion } = renderHookWithProviders(() =>
      useVaultEntriesQuery({ topic: 'fashion' }),
    )

    await waitFor(() => expect(food.current.isSuccess).toBe(true))
    await waitFor(() => expect(fashion.current.isSuccess).toBe(true))

    // Two distinct fetches — if the query key weren't topic-scoped, the
    // second hook would be served from cache and the call count would be 1.
    expect(mockApiRequest).toHaveBeenCalledTimes(2)
  })
})

describe('useDeleteVaultEntryMutation', () => {
  it('hits DELETE /v1/vault/entries/:id', async () => {
    mockApiRequest.mockResolvedValueOnce({ success: true, data: null })

    const { result } = renderHookWithProviders(() => useDeleteVaultEntryMutation())

    await act(async () => {
      await result.current.mutateAsync(FASHION_RECORD.id)
    })

    expect(mockApiRequest).toHaveBeenCalledWith(
      `/v1/vault/entries/${FASHION_RECORD.id}`,
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('throws when the API returns success: false', async () => {
    mockApiRequest.mockResolvedValueOnce({ success: false, error: 'Not found' })
    const { result } = renderHookWithProviders(() => useDeleteVaultEntryMutation())

    await act(async () => {
      await expect(result.current.mutateAsync('no-such-id')).rejects.toThrow('Not found')
    })
  })
})

describe('useCreateVaultEntryMutation (Phase-6 confirm path)', () => {
  it('hits POST /v1/vault/entries with the full input body', async () => {
    mockApiRequest.mockResolvedValueOnce({ success: true, data: FASHION_RECORD })
    const { result } = renderHookWithProviders(() => useCreateVaultEntryMutation())

    const input = {
      type: 'preference' as const,
      topic: 'fashion' as const,
      content: FASHION_RECORD.content,
    }
    await act(async () => {
      await result.current.mutateAsync(input)
    })

    expect(mockApiRequest).toHaveBeenCalledWith(
      '/v1/vault/entries',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(input) }),
    )
  })
})
