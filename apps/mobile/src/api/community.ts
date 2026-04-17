import { useMutation, useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from './client'
import type {
  Circle,
  PostListItem,
  PostDetail,
  Reply,
  FollowUser,
  UploadUrlResponse,
  CommunityCircle,
  ReportReason,
} from '@halo/shared'

// ─── Response Types ──────────────────────────────────────────────────────────

interface PostFeedResponse {
  items: PostListItem[]
  nextCursor: string | null
}

interface SpotlightResponse {
  featured: PostListItem[]
  trending: PostListItem[]
  nextCursor: string | null
}

interface ReplyFeedResponse {
  items: Reply[]
  nextCursor: string | null
}

interface FollowFeedResponse {
  items: FollowUser[]
  nextCursor: string | null
}

// ─── Circles ─────────────────────────────────────────────────────────────────

export function useCirclesQuery() {
  return useQuery({
    queryKey: ['community', 'circles'],
    queryFn: async () => {
      const result = await apiRequest<Circle[]>('/v1/community/circles')
      if (!result.success) throw new Error(result.error)
      return result.data ?? []
    },
    staleTime: 30 * 60 * 1000, // 30 minutes — circles rarely change
  })
}

// ─── Post Feeds ──────────────────────────────────────────────────────────────

export function useExploreFeedQuery(circle?: CommunityCircle) {
  return useInfiniteQuery({
    queryKey: ['community', 'explore', circle],
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      const params = new URLSearchParams()
      if (circle) params.set('circle', circle)
      if (pageParam) params.set('cursor', pageParam)
      params.set('limit', '20')

      const result = await apiRequest<PostListItem[]>(`/v1/community/posts?${params.toString()}`)
      if (!result.success) throw new Error(result.error)

      const meta = result.meta
      return {
        items: result.data ?? [],
        nextCursor: meta?.nextCursor ?? null,
      } as PostFeedResponse
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 2 * 60 * 1000,
  })
}

export function useFollowingFeedQuery() {
  return useInfiniteQuery({
    queryKey: ['community', 'following'],
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      const params = new URLSearchParams()
      if (pageParam) params.set('cursor', pageParam)
      params.set('limit', '20')

      const result = await apiRequest<PostListItem[]>(
        `/v1/community/posts/following?${params.toString()}`,
      )
      if (!result.success) throw new Error(result.error)

      const meta = result.meta
      return {
        items: result.data ?? [],
        nextCursor: meta?.nextCursor ?? null,
      } as PostFeedResponse
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 2 * 60 * 1000,
  })
}

export function useSpotlightQuery() {
  return useQuery({
    queryKey: ['community', 'spotlight'],
    queryFn: async () => {
      const result = await apiRequest<SpotlightResponse>('/v1/community/posts/spotlight')
      if (!result.success) throw new Error(result.error)
      return result.data ?? { featured: [], trending: [], nextCursor: null }
    },
    staleTime: 5 * 60 * 1000,
  })
}

// ─── Post Detail ─────────────────────────────────────────────────────────────

export function usePostDetailQuery(postId: string | null) {
  return useQuery({
    queryKey: ['community', 'post', postId],
    queryFn: async () => {
      const result = await apiRequest<PostDetail>(`/v1/community/posts/${postId}`)
      if (!result.success) throw new Error(result.error)
      return result.data!
    },
    enabled: !!postId,
    staleTime: 60 * 1000,
  })
}

// ─── Replies ─────────────────────────────────────────────────────────────────

export function useRepliesQuery(postId: string) {
  return useInfiniteQuery({
    queryKey: ['community', 'replies', postId],
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      const params = new URLSearchParams()
      if (pageParam) params.set('cursor', pageParam)
      params.set('limit', '20')

      const result = await apiRequest<Reply[]>(
        `/v1/community/posts/${postId}/replies?${params.toString()}`,
      )
      if (!result.success) throw new Error(result.error)

      const meta = result.meta
      return {
        items: result.data ?? [],
        nextCursor: meta?.nextCursor ?? null,
      } as ReplyFeedResponse
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 60 * 1000,
  })
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export function useCreatePost() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      circleSlug: CommunityCircle
      title: string
      body: string
      imageUrls?: string[]
    }) => {
      const result = await apiRequest<{ id: string }>('/v1/community/posts', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      if (!result.success) throw new Error(result.error)
      return result.data!
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['community'] })
    },
  })
}

export function useCreateReply(postId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (body: string) => {
      const result = await apiRequest<{ id: string }>(`/v1/community/posts/${postId}/replies`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      })
      if (!result.success) throw new Error(result.error)
      return result.data!
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['community', 'replies', postId] })
      void queryClient.invalidateQueries({ queryKey: ['community', 'post', postId] })
    },
  })
}

export function useDeletePost() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (postId: string) => {
      const result = await apiRequest(`/v1/community/posts/${postId}`, { method: 'DELETE' })
      if (!result.success) throw new Error(result.error)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['community'] })
    },
  })
}

export function useDeleteReply(postId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (replyId: string) => {
      const result = await apiRequest(`/v1/community/posts/${postId}/replies/${replyId}`, {
        method: 'DELETE',
      })
      if (!result.success) throw new Error(result.error)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['community', 'replies', postId] })
      void queryClient.invalidateQueries({ queryKey: ['community', 'post', postId] })
    },
  })
}

export function useTogglePostLike() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (postId: string) => {
      const result = await apiRequest<{ liked: boolean; likeCount: number }>(
        `/v1/community/posts/${postId}/like`,
        { method: 'POST' },
      )
      if (!result.success) throw new Error(result.error)
      return result.data!
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['community'] })
    },
  })
}

export function useToggleReplyLike(postId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (replyId: string) => {
      const result = await apiRequest<{ liked: boolean; likeCount: number }>(
        `/v1/community/replies/${replyId}/like`,
        { method: 'POST' },
      )
      if (!result.success) throw new Error(result.error)
      return result.data!
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['community', 'replies', postId] })
    },
  })
}

export function useToggleFollow() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (userId: string) => {
      const result = await apiRequest<{ following: boolean }>(
        `/v1/community/users/${userId}/follow`,
        { method: 'POST' },
      )
      if (!result.success) throw new Error(result.error)
      return result.data!
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['community'] })
    },
  })
}

export function useReport() {
  return useMutation({
    mutationFn: async (data: {
      type: 'post' | 'reply'
      targetId: string
      postId?: string
      reason: ReportReason
      details?: string
    }) => {
      const path =
        data.type === 'post'
          ? `/v1/community/posts/${data.targetId}/report`
          : `/v1/community/replies/${data.targetId}/report`

      const result = await apiRequest<{ id: string; alreadyReported: boolean }>(path, {
        method: 'POST',
        body: JSON.stringify({ reason: data.reason, details: data.details }),
      })
      if (!result.success) throw new Error(result.error)
      return result.data!
    },
  })
}

export function useUploadUrl() {
  return useMutation({
    mutationFn: async (data: { filename: string; contentType: string }) => {
      const result = await apiRequest<UploadUrlResponse>('/v1/community/upload-url', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      if (!result.success) throw new Error(result.error)
      return result.data!
    },
  })
}

// ─── Follow Lists ────────────────────────────────────────────────────────────

export function useFollowersQuery(userId: string) {
  return useInfiniteQuery({
    queryKey: ['community', 'followers', userId],
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      const params = new URLSearchParams()
      if (pageParam) params.set('cursor', pageParam)
      params.set('limit', '20')

      const result = await apiRequest<FollowUser[]>(
        `/v1/community/users/${userId}/followers?${params.toString()}`,
      )
      if (!result.success) throw new Error(result.error)

      const meta = result.meta
      return {
        items: result.data ?? [],
        nextCursor: meta?.nextCursor ?? null,
      } as FollowFeedResponse
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 5 * 60 * 1000,
  })
}

export function useFollowingQuery(userId: string) {
  return useInfiniteQuery({
    queryKey: ['community', 'following-list', userId],
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      const params = new URLSearchParams()
      if (pageParam) params.set('cursor', pageParam)
      params.set('limit', '20')

      const result = await apiRequest<FollowUser[]>(
        `/v1/community/users/${userId}/following?${params.toString()}`,
      )
      if (!result.success) throw new Error(result.error)

      const meta = result.meta
      return {
        items: result.data ?? [],
        nextCursor: meta?.nextCursor ?? null,
      } as FollowFeedResponse
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 5 * 60 * 1000,
  })
}
