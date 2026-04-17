import { z } from 'zod'
import { userProfileSchema } from './user.js'

// POST /v1/auth/otp/send
export const sendOtpSchema = z.object({
  email: z
    .string()
    .email()
    .transform((e) => e.toLowerCase().trim()),
})

// POST /v1/auth/otp/verify
export const verifyOtpSchema = z.object({
  email: z
    .string()
    .email()
    .transform((e) => e.toLowerCase().trim()),
  code: z
    .string()
    .length(6)
    .regex(/^\d{6}$/, 'Code must be exactly 6 digits'),
})

// Response from POST /v1/auth/otp/verify
export const otpVerifyResponseSchema = z.object({
  customToken: z.string(),
  user: userProfileSchema.nullable(),
})

export type OtpVerifyResponse = z.infer<typeof otpVerifyResponseSchema>
