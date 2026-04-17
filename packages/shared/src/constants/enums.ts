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

export const CHALLENGES = [
  'behavioral',
  'communication',
  'daily_care',
  'self_care',
  'safety',
  'legal_financial',
  'emotional',
] as const

export const AI_MESSAGE_ROLES = ['user', 'assistant', 'system'] as const

export const FEEDBACK_RATINGS = ['thumbs_up', 'thumbs_down'] as const

export const CONTENT_CATEGORIES = [
  'understanding_disease',
  'daily_care',
  'behavioral_management',
  'communication',
  'safety',
  'self_care',
  'legal_financial',
] as const

export type CaregiverRelationship = (typeof CAREGIVER_RELATIONSHIPS)[number]
export type DiagnosisStage = (typeof DIAGNOSIS_STAGES)[number]
export type UserTier = (typeof USER_TIERS)[number]
export type UserRole = (typeof USER_ROLES)[number]
export type Challenge = (typeof CHALLENGES)[number]
export type AiMessageRole = (typeof AI_MESSAGE_ROLES)[number]
export type FeedbackRating = (typeof FEEDBACK_RATINGS)[number]
export type ContentCategory = (typeof CONTENT_CATEGORIES)[number]

// ─── Community ───────────────────────────────────────────────────────────────

export const COMMUNITY_CIRCLES = [
  'emotional-support',
  'daily-care-tips',
  'caregiver-stories',
  'medical-questions',
  'activities-engagement',
  'legal-financial',
  'resources-recommendations',
  'humor-light-moments',
] as const

export const POST_STATUSES = ['active', 'flagged', 'removed'] as const

export const REPORT_REASONS = [
  'spam',
  'harassment',
  'misinformation',
  'phi_exposure',
  'inappropriate',
  'other',
] as const

export const REPORT_STATUSES = ['pending', 'reviewed', 'actioned', 'dismissed'] as const

export type CommunityCircle = (typeof COMMUNITY_CIRCLES)[number]
export type PostStatus = (typeof POST_STATUSES)[number]
export type ReportReason = (typeof REPORT_REASONS)[number]
export type ReportStatus = (typeof REPORT_STATUSES)[number]

export const TIP_CATEGORIES = [
  'Self Care',
  'Communication',
  'Daily Care',
  'Safety',
  'Emotional',
  'Behavioral',
] as const

export type TipCategory = (typeof TIP_CATEGORIES)[number]
