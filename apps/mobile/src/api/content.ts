import { useMutation, useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from './client'
import type { ContentListItem, ContentItem } from '@halo/shared'

interface ListContentResponse {
  items: ContentListItem[]
  nextCursor: string | null
}

export interface ContentDetailResponse extends ContentItem {
  isBookmarked: boolean
  progressPercent: number | null
}

interface ContentFilters {
  search?: string
  category?: string
  stage?: string
}

export function useContentQuery(filters: ContentFilters) {
  return useInfiniteQuery({
    queryKey: ['content', 'list', filters],
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      const params = new URLSearchParams()
      if (filters.search) params.set('search', filters.search)
      if (filters.category) params.set('category', filters.category)
      if (filters.stage) params.set('stage', filters.stage)
      if (pageParam) params.set('cursor', pageParam)
      params.set('limit', '20')

      const result = await apiRequest<ContentListItem[]>(`/v1/content?${params.toString()}`)
      if (!result.success) throw new Error(result.error)

      const meta = result.meta
      return {
        items: result.data ?? [],
        nextCursor: meta?.nextCursor ?? null,
      } as ListContentResponse
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

export function useBrowseContentQuery() {
  return useQuery({
    queryKey: ['content', 'browse'],
    queryFn: async () => {
      const result = await apiRequest<ContentListItem[]>('/v1/content?limit=50')
      if (!result.success) throw new Error(result.error)
      return result.data ?? []
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useContentBySlugQuery(slug: string | null) {
  return useQuery({
    queryKey: ['content', 'detail', slug],
    queryFn: async () => {
      if (!slug) throw new Error('No slug')
      const result = await apiRequest<ContentDetailResponse>(`/v1/content/${slug}`)
      if (!result.success) throw new Error(result.error)
      return result.data
    },
    enabled: !!slug,
    staleTime: 10 * 60 * 1000, // 10 minutes
  })
}

export function useToggleBookmark() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (contentItemId: string) => {
      const result = await apiRequest<{ bookmarked: boolean }>(
        `/v1/content/${contentItemId}/bookmark`,
        { method: 'POST' },
      )
      if (!result.success) throw new Error(result.error)
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content'] })
    },
  })
}

export function useUpdateProgress() {
  return useMutation({
    mutationFn: async ({
      contentItemId,
      progressPercent,
    }: {
      contentItemId: string
      progressPercent: number
    }) => {
      const result = await apiRequest(`/v1/content/${contentItemId}/progress`, {
        method: 'PUT',
        body: JSON.stringify({ progressPercent }),
      })
      if (!result.success) throw new Error(result.error)
      return result.data
    },
  })
}

export function useBookmarksQuery() {
  return useInfiniteQuery({
    queryKey: ['content', 'bookmarks'],
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      const params = new URLSearchParams()
      if (pageParam) params.set('cursor', pageParam)
      params.set('limit', '20')

      const result = await apiRequest<ContentListItem[]>(
        `/v1/content/bookmarks?${params.toString()}`,
      )
      if (!result.success) throw new Error(result.error)

      const meta = result.meta
      return {
        items: result.data ?? [],
        nextCursor: meta?.nextCursor ?? null,
      } as ListContentResponse
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })
}
