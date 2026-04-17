import { useQuery } from '@tanstack/react-query'
import { apiRequest } from './client'
import type { DailyTip } from '@halo/shared'

export function useDailyTipQuery() {
  return useQuery({
    queryKey: ['tips', 'daily'],
    queryFn: async () => {
      const result = await apiRequest<DailyTip>('/v1/tips/daily')
      if (!result.success) throw new Error(result.error ?? 'Failed to load daily tip')
      return result.data
    },
    staleTime: 1000 * 60 * 60, // 1 hour — tip changes daily
    gcTime: 1000 * 60 * 60 * 24, // 24 hours — keep in cache all day
  })
}
