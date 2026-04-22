import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  VaultEntryInput,
  VaultEntryListItem,
  VaultEntryRecord,
  VaultTopic,
} from '@halo/shared'
import { apiRequest } from './client'

const QUERY_KEY_ROOT = ['vault', 'entries'] as const

/**
 * Topic-scoped list of vault entries. The API returns `VaultEntryListItem[]`
 * which is a discriminated union: well-formed records OR `{ decryptionFailed:
 * true, rawType, rawTopic, content: null }` sentinels. UI code must narrow on
 * `decryptionFailed` before touching `content`.
 */
export function useVaultEntriesQuery({ topic }: { topic: VaultTopic }) {
  return useQuery({
    queryKey: [...QUERY_KEY_ROOT, { topic }],
    queryFn: async () => {
      const result = await apiRequest<VaultEntryListItem[]>(
        `/v1/vault/entries?topic=${encodeURIComponent(topic)}`,
      )
      if (!result.success) throw new Error(result.error ?? 'Failed to load memories')
      return result.data
    },
  })
}

/**
 * Soft-delete a memory by id. Takes `{ id, topic }` so `onSuccess` can
 * invalidate only the affected topic's query instead of refetching all
 * three — meaningful difference for a user with memories across topics.
 */
export function useDeleteVaultEntryMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id }: { id: string; topic: VaultTopic }) => {
      const result = await apiRequest<null>(`/v1/vault/entries/${id}`, { method: 'DELETE' })
      if (!result.success) throw new Error(result.error ?? 'Failed to delete memory')
      return result.data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEY_ROOT, { topic: variables.topic }] })
    },
  })
}

export function useClearVaultTopicMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (topic: VaultTopic) => {
      const result = await apiRequest<null>(
        `/v1/vault/entries?topic=${encodeURIComponent(topic)}`,
        { method: 'DELETE' },
      )
      if (!result.success) throw new Error(result.error ?? 'Failed to clear memories')
      return result.data
    },
    onSuccess: (_data, topic) => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEY_ROOT, { topic }] })
    },
  })
}

/**
 * Create a vault entry. Phase-6 proposal-confirm path uses this to persist
 * agent-proposed memories; any future in-app "add memory" form does too.
 * Invalidates only the affected topic's query so unrelated sections don't
 * refetch.
 */
export function useCreateVaultEntryMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: VaultEntryInput) => {
      const result = await apiRequest<VaultEntryRecord>('/v1/vault/entries', {
        method: 'POST',
        body: JSON.stringify(input),
      })
      if (!result.success) throw new Error(result.error ?? 'Failed to save memory')
      return result.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEY_ROOT, { topic: data.topic }] })
    },
  })
}
