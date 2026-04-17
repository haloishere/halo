import { useMutation } from '@tanstack/react-query'
import { apiRequest } from './client'
import type { OtpVerifyResponse } from '@halo/shared'

interface SendOtpPayload {
  email: string
}

interface VerifyOtpPayload {
  email: string
  code: string
}

export function useSendOtpMutation() {
  return useMutation({
    retry: false,
    mutationFn: async (payload: SendOtpPayload) => {
      const result = await apiRequest<{ message: string }>('/v1/auth/otp/send', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      if (!result.success) throw new Error(result.error ?? 'An unexpected error occurred')
      return result.data
    },
  })
}

export function useVerifyOtpMutation() {
  return useMutation({
    retry: false,
    mutationFn: async (payload: VerifyOtpPayload) => {
      const result = await apiRequest<OtpVerifyResponse>('/v1/auth/otp/verify', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      if (!result.success) throw new Error(result.error ?? 'An unexpected error occurred')
      if (!result.data) throw new Error('Missing verification response')
      return result.data
    },
  })
}
