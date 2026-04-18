import { z } from 'zod'
import { USER_ROLES, USER_TIERS } from '../constants/enums.js'

// Intentionally uses literal space (not \s) to reject tabs, newlines, and non-breaking spaces
export const DISPLAY_NAME_PATTERN = /^[\p{L} '.-]+$/u
export const DISPLAY_NAME_MAX_LENGTH = 100
export const DISPLAY_NAME_ERROR =
  'Name may only contain letters, spaces, hyphens, apostrophes, and periods'

export const CITY_MAX_LENGTH = 100

export const onboardingSchema = z.object({
  displayName: z
    .string()
    .min(1)
    .max(DISPLAY_NAME_MAX_LENGTH)
    .regex(DISPLAY_NAME_PATTERN, DISPLAY_NAME_ERROR)
    .optional(),
  city: z.string().min(1).max(CITY_MAX_LENGTH).optional(),
})

export const userProfileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string().min(1).max(100),
  tier: z.enum(USER_TIERS),
  role: z.enum(USER_ROLES),
  city: z.string().max(CITY_MAX_LENGTH).nullable(),
  onboardingCompleted: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type Onboarding = z.infer<typeof onboardingSchema>
export type UserProfile = z.infer<typeof userProfileSchema>
