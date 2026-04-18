// Retained until Stage 7 drops the matching `users` columns via migration.
// Drizzle's `users` table still declares pgEnums over these tuples.
export const CAREGIVER_RELATIONSHIPS = [
  'spouse',
  'child',
  'sibling',
  'professional',
  'other',
] as const

export const DIAGNOSIS_STAGES = ['early', 'middle', 'late', 'unknown'] as const

export const USER_TIERS = ['free', 'premium'] as const

export const USER_ROLES = ['user', 'moderator', 'admin'] as const

export const AI_MESSAGE_ROLES = ['user', 'assistant', 'system'] as const

export const FEEDBACK_RATINGS = ['thumbs_up', 'thumbs_down'] as const

export type CaregiverRelationship = (typeof CAREGIVER_RELATIONSHIPS)[number]
export type DiagnosisStage = (typeof DIAGNOSIS_STAGES)[number]
export type UserTier = (typeof USER_TIERS)[number]
export type UserRole = (typeof USER_ROLES)[number]
export type AiMessageRole = (typeof AI_MESSAGE_ROLES)[number]
export type FeedbackRating = (typeof FEEDBACK_RATINGS)[number]
