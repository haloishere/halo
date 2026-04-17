import type { UserProfile } from '@halo/shared'

export function toUserProfile(user: {
  id: string
  email: string
  displayName: string
  tier: string
  role: string
  caregiverRelationship: string | null
  diagnosisStage: string | null
  challenges: string[] | null
  onboardingCompleted: Date | null
  createdAt: Date
  updatedAt: Date
}): UserProfile {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    tier: user.tier as UserProfile['tier'],
    role: user.role as UserProfile['role'],
    caregiverRelationship: user.caregiverRelationship as UserProfile['caregiverRelationship'],
    diagnosisStage: user.diagnosisStage as UserProfile['diagnosisStage'],
    challenges: user.challenges as UserProfile['challenges'],
    onboardingCompleted: user.onboardingCompleted?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  }
}
