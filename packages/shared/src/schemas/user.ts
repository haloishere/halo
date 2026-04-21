import { z } from 'zod'
import { USER_ROLES, USER_TIERS } from '../constants/enums.js'

// Intentionally uses literal space (not \s) to reject tabs, newlines, and non-breaking spaces
export const DISPLAY_NAME_PATTERN = /^[\p{L} '.-]+$/u
export const DISPLAY_NAME_MAX_LENGTH = 100
export const DISPLAY_NAME_ERROR =
  'Name may only contain letters, spaces, hyphens, apostrophes, and periods'

export const CITY_MAX_LENGTH = 100

// Age floor 16 aligns with GDPR Art. 8 digital-consent default.
// Ceiling 120 is a generous upper bound for a plausible human age.
export const AGE_MIN = 16
export const AGE_MAX = 120

export const onboardingSchema = z
  .object({
    displayName: z
      .string()
      .min(1)
      .max(DISPLAY_NAME_MAX_LENGTH)
      .regex(DISPLAY_NAME_PATTERN, DISPLAY_NAME_ERROR)
      .optional(),
    age: z.number().int().min(AGE_MIN).max(AGE_MAX).optional(),
    // `.trim()` strips leading/trailing whitespace BEFORE `.min(1)` so that
    // `"   "` rejects with "String must contain at least 1 character(s)"
    // instead of silently reaching the service and being dropped on write.
    city: z.string().trim().min(1).max(CITY_MAX_LENGTH).optional(),
  })
  // Reject empty POSTs so a client can't complete onboarding with zero data.
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  })

export const userProfileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string().min(1).max(100),
  tier: z.enum(USER_TIERS),
  role: z.enum(USER_ROLES),
  age: z.number().int().min(AGE_MIN).max(AGE_MAX).nullable(),
  city: z.string().trim().min(1).max(CITY_MAX_LENGTH).nullable(),
  onboardingCompleted: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type Onboarding = z.infer<typeof onboardingSchema>
export type UserProfile = z.infer<typeof userProfileSchema>
