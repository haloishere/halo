import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { VaultEntryInput, VaultEntryListItem, VaultEntryRecord, VaultTopic } from '@halo/shared'
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
        `/v1/vault/entries?topic=${topic}`,
      )
      if (!result.success) throw new Error(result.error)
      return result.data
    },
  })
}

/** Soft-delete a memory by id. Invalidates the whole vault entries tree. */
export function useDeleteVaultEntryMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await apiRequest<null>(`/v1/vault/entries/${id}`, { method: 'DELETE' })
      if (!result.success) throw new Error(result.error)
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_ROOT })
    },
  })
}

/**
 * Create a vault entry. Phase-6 proposal-confirm path uses this to persist
 * agent-proposed memories; any future in-app "add memory" form does too.
 * Invalidates the whole vault entries tree so a just-saved card shows up
 * in Portrait without a manual refresh.
 */
export function useCreateVaultEntryMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: VaultEntryInput) => {
      const result = await apiRequest<VaultEntryRecord>('/v1/vault/entries', {
        method: 'POST',
        body: JSON.stringify(input),
      })
      if (!result.success) throw new Error(result.error)
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY_ROOT })
    },
  })
}
