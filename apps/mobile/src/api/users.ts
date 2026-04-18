import { useMutation, useQuery } from '@tanstack/react-query'
import { apiRequest } from './client'
import type { UserProfile, Onboarding } from '@halo/shared'

export function useProfileQuery() {
  return useQuery({
    queryKey: ['users', 'me'],
    queryFn: async () => {
      const result = await apiRequest<UserProfile>('/v1/users/me')
      if (!result.success) throw new Error(result.error)
      return result.data
    },
  })
}

export function useOnboardingMutation() {
  return useMutation({
    mutationFn: async (data: Onboarding) => {
      const result = await apiRequest<UserProfile>('/v1/users/me/onboarding', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      if (!result.success) throw new Error(result.error)
      return result.data
    },
  })
}
