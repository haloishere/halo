import { z } from 'zod'
import {
  CAREGIVER_RELATIONSHIPS,
  CHALLENGES,
  DIAGNOSIS_STAGES,
  USER_ROLES,
  USER_TIERS,
} from '../constants/enums.js'

// Intentionally uses literal space (not \s) to reject tabs, newlines, and non-breaking spaces
export const DISPLAY_NAME_PATTERN = /^[\p{L} '.-]+$/u
export const DISPLAY_NAME_MAX_LENGTH = 100
export const DISPLAY_NAME_ERROR =
  'Name may only contain letters, spaces, hyphens, apostrophes, and periods'

export const onboardingSchema = z.object({
  displayName: z
    .string()
    .min(1)
    .max(DISPLAY_NAME_MAX_LENGTH)
    .regex(DISPLAY_NAME_PATTERN, DISPLAY_NAME_ERROR)
    .optional(),
  caregiverRelationship: z.enum(CAREGIVER_RELATIONSHIPS),
  diagnosisStage: z.enum(DIAGNOSIS_STAGES),
  challenges: z.array(z.enum(CHALLENGES)).min(1).max(CHALLENGES.length),
})

export const userProfileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string().min(1).max(100),
  tier: z.enum(USER_TIERS),
  role: z.enum(USER_ROLES),
  caregiverRelationship: z.enum(CAREGIVER_RELATIONSHIPS).nullable(),
  diagnosisStage: z.enum(DIAGNOSIS_STAGES).nullable(),
  challenges: z.array(z.enum(CHALLENGES)).nullable(),
  onboardingCompleted: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type Onboarding = z.infer<typeof onboardingSchema>
export type UserProfile = z.infer<typeof userProfileSchema>
