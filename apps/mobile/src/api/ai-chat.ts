import { useMutation, useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from './client'
import type { AiConversation, AiMessage, CreateConversation, SubmitFeedback } from '@halo/shared'

interface ConversationWithMessages extends AiConversation {
  messages: AiMessage[]
}

interface ListConversationsResponse {
  conversations: AiConversation[]
  nextCursor: string | null
}

export function useConversationsQuery() {
  return useInfiniteQuery({
    queryKey: ['ai', 'conversations'],
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      const params = new URLSearchParams()
      if (pageParam) params.set('cursor', pageParam)
      params.set('limit', '20')

      const result = await apiRequest<AiConversation[]>(`/v1/ai/conversations?${params.toString()}`)
      if (!result.success) throw new Error(result.error)

      const meta = result.meta
      return {
        conversations: result.data ?? [],
        nextCursor: meta?.nextCursor ?? null,
      } as ListConversationsResponse
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })
}

export function useConversationQuery(conversationId: string | null) {
  return useQuery({
    queryKey: ['ai', 'conversations', conversationId],
    queryFn: async () => {
      if (!conversationId) throw new Error('No conversation ID')
      const result = await apiRequest<ConversationWithMessages>(
        `/v1/ai/conversations/${conversationId}`,
      )
      if (!result.success) throw new Error(result.error)
      return result.data
    },
    enabled: !!conversationId,
  })
}

export function useCreateConversation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: CreateConversation) => {
      const result = await apiRequest<AiConversation>('/v1/ai/conversations', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      if (!result.success) throw new Error(result.error)
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai', 'conversations'] })
    },
  })
}

export function useDeleteConversation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (conversationId: string) => {
      const result = await apiRequest(`/v1/ai/conversations/${conversationId}`, {
        method: 'DELETE',
      })
      if (!result.success) throw new Error(result.error)
    },
    onSuccess: (_, conversationId) => {
      // Remove the individual conversation cache entry so any mounted
      // chat screen (which is still in the background stack while history
      // is open) sees its query transition to error immediately and can
      // navigate away before the user presses back.
      // `invalidateQueries` alone only marks it stale — it won't force a
      // refetch on a non-focused screen. `removeQueries` eliminates the
      // entry, causing active observers to refetch right away.
      queryClient.removeQueries({ queryKey: ['ai', 'conversations', conversationId] })
      queryClient.invalidateQueries({ queryKey: ['ai', 'conversations'] })
    },
  })
}

export function useSubmitFeedback() {
  return useMutation({
    mutationFn: async ({
      conversationId,
      messageId,
      data,
    }: {
      conversationId: string
      messageId: string
      data: SubmitFeedback
    }) => {
      const result = await apiRequest<AiMessage>(
        `/v1/ai/conversations/${conversationId}/feedback/${messageId}`,
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
      )
      if (!result.success) throw new Error(result.error)
      return result.data
    },
  })
}
