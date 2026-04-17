import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, waitFor } from '@testing-library/react-native'
import { renderHookWithProviders } from '../../test/renderWithProviders'

vi.mock('../client', () => ({
  apiRequest: vi.fn(),
}))

import { apiRequest } from '../client'
import {
  useBrowseContentQuery,
  useContentQuery,
  useContentBySlugQuery,
  useToggleBookmark,
  useUpdateProgress,
  useBookmarksQuery,
} from '../content'

const mockApiRequest = vi.mocked(apiRequest)

beforeEach(() => {
  mockApiRequest.mockReset()
})

const testItem = {
  id: 'item-1',
  title: 'Understanding Sundowning',
  slug: 'understanding-sundowning',
  snippet: 'Sundowning is a common behavior...',
  category: 'behavioral_management',
  diagnosisStages: ['middle', 'late'],
  videoUrl: null,
  thumbnailUrl: null,
  isBookmarked: false,
  progressPercent: null,
  publishedAt: '2024-01-01T00:00:00Z',
  createdAt: '2024-01-01T00:00:00Z',
}

describe('useBrowseContentQuery', () => {
  it('fetches content with limit=50 for browse view', async () => {
    mockApiRequest.mockResolvedValueOnce({
      success: true,
      data: [testItem],
    })

    const { result } = renderHookWithProviders(() => useBrowseContentQuery())

    await waitFor(() => expect(result.current.data).toEqual([testItem]))
    expect(mockApiRequest).toHaveBeenCalledWith('/v1/content?limit=50')
  })

  it('returns empty array on API failure', async () => {
    mockApiRequest.mockResolvedValueOnce({ success: false, error: 'Server error' })

    const { result } = renderHookWithProviders(() => useBrowseContentQuery())

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('Server error')
  })
})

describe('useContentQuery', () => {
  it('fetches content list with default params', async () => {
    mockApiRequest.mockResolvedValueOnce({
      success: true,
      data: [testItem],
      meta: { nextCursor: null },
    })

    const { result } = renderHookWithProviders(() => useContentQuery({}))

    await waitFor(() => expect(result.current.data?.pages).toHaveLength(1))
    expect(result.current.data?.pages[0]?.items).toEqual([testItem])
  })

  it('passes search and category as query params', async () => {
    mockApiRequest.mockResolvedValueOnce({
      success: true,
      data: [testItem],
      meta: { nextCursor: null },
    })

    renderHookWithProviders(() =>
      useContentQuery({ search: 'sundowning', category: 'behavioral_management' }),
    )

    await waitFor(() => expect(mockApiRequest).toHaveBeenCalled())
    const url = mockApiRequest.mock.calls[0]?.[0] as string
    expect(url).toContain('search=sundowning')
    expect(url).toContain('category=behavioral_management')
  })
})

describe('useContentBySlugQuery', () => {
  it('fetches single content item by slug', async () => {
    const detail = { ...testItem, body: '# Full content here' }
    mockApiRequest.mockResolvedValueOnce({ success: true, data: detail })

    const { result } = renderHookWithProviders(() =>
      useContentBySlugQuery('understanding-sundowning'),
    )

    await waitFor(() => expect(result.current.data).toEqual(detail))
    expect(mockApiRequest).toHaveBeenCalledWith('/v1/content/understanding-sundowning')
  })

  it('does not fetch when slug is null', () => {
    const { result } = renderHookWithProviders(() => useContentBySlugQuery(null))

    expect(result.current.fetchStatus).toBe('idle')
    expect(mockApiRequest).not.toHaveBeenCalled()
  })
})

describe('useToggleBookmark', () => {
  it('sends POST to toggle bookmark', async () => {
    mockApiRequest.mockResolvedValueOnce({
      success: true,
      data: { bookmarked: true },
    })

    const { result } = renderHookWithProviders(() => useToggleBookmark())

    await act(async () => {
      result.current.mutate('item-1')
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockApiRequest).toHaveBeenCalledWith('/v1/content/item-1/bookmark', {
      method: 'POST',
    })
  })
})

describe('useUpdateProgress', () => {
  it('sends PUT to update progress', async () => {
    mockApiRequest.mockResolvedValueOnce({
      success: true,
      data: { progressPercent: 75, completedAt: null },
    })

    const { result } = renderHookWithProviders(() => useUpdateProgress())

    await act(async () => {
      result.current.mutate({ contentItemId: 'item-1', progressPercent: 75 })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockApiRequest).toHaveBeenCalledWith('/v1/content/item-1/progress', {
      method: 'PUT',
      body: JSON.stringify({ progressPercent: 75 }),
    })
  })
})

describe('useBookmarksQuery', () => {
  it('fetches bookmarked items', async () => {
    mockApiRequest.mockResolvedValueOnce({
      success: true,
      data: [testItem],
      meta: { nextCursor: null },
    })

    const { result } = renderHookWithProviders(() => useBookmarksQuery())

    await waitFor(() => expect(result.current.data?.pages).toHaveLength(1))
    expect(result.current.data?.pages[0]?.items).toEqual([testItem])
  })
})

describe('useToggleBookmark — error path', () => {
  it('throws when API returns failure', async () => {
    mockApiRequest.mockResolvedValueOnce({ success: false, error: 'Not found' })

    const { result } = renderHookWithProviders(() => useToggleBookmark())

    await act(async () => {
      result.current.mutate('item-999')
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('Not found')
  })
})
