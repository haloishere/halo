import { describe, it, expect } from 'vitest'
import { onboardingSchema, userProfileSchema } from '../user'

describe('onboardingSchema', () => {
  it('accepts valid onboarding data', () => {
    const result = onboardingSchema.safeParse({
      caregiverRelationship: 'spouse',
      diagnosisStage: 'early',
      challenges: ['behavioral', 'communication'],
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid caregiver relationship', () => {
    const result = onboardingSchema.safeParse({
      caregiverRelationship: 'friend',
      diagnosisStage: 'early',
      challenges: ['behavioral'],
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid diagnosis stage', () => {
    const result = onboardingSchema.safeParse({
      caregiverRelationship: 'child',
      diagnosisStage: 'severe',
      challenges: ['behavioral'],
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty challenges array', () => {
    const result = onboardingSchema.safeParse({
      caregiverRelationship: 'spouse',
      diagnosisStage: 'middle',
      challenges: [],
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid challenge values', () => {
    const result = onboardingSchema.safeParse({
      caregiverRelationship: 'spouse',
      diagnosisStage: 'late',
      challenges: ['invalid_challenge'],
    })
    expect(result.success).toBe(false)
  })

  it('accepts all valid challenge values', () => {
    const result = onboardingSchema.safeParse({
      caregiverRelationship: 'professional',
      diagnosisStage: 'unknown',
      challenges: [
        'behavioral',
        'communication',
        'daily_care',
        'self_care',
        'safety',
        'legal_financial',
        'emotional',
      ],
    })
    expect(result.success).toBe(true)
  })

  // #16: challenges array must have a max bound to prevent payload inflation
  it('rejects challenges array exceeding max allowed length', () => {
    // Create an array longer than CHALLENGES.length by duplicating
    const tooMany = [
      'behavioral',
      'communication',
      'daily_care',
      'self_care',
      'safety',
      'legal_financial',
      'emotional',
      'behavioral', // duplicate, exceeds CHALLENGES.length (7)
    ]
    const result = onboardingSchema.safeParse({
      caregiverRelationship: 'spouse',
      diagnosisStage: 'early',
      challenges: tooMany,
    })
    expect(result.success).toBe(false)
  })
})

describe('userProfileSchema', () => {
  const validProfile = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    email: 'caregiver@example.com',
    displayName: 'Jane Doe',
    tier: 'free',
    role: 'user',
    caregiverRelationship: 'spouse',
    diagnosisStage: 'early',
    challenges: ['behavioral'],
    onboardingCompleted: '2026-01-15T10:30:00Z',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-15T10:30:00Z',
  }

  it('accepts valid profile', () => {
    const result = userProfileSchema.safeParse(validProfile)
    expect(result.success).toBe(true)
  })

  it('accepts nullable fields as null', () => {
    const result = userProfileSchema.safeParse({
      ...validProfile,
      caregiverRelationship: null,
      diagnosisStage: null,
      challenges: null,
      onboardingCompleted: null,
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid uuid', () => {
    const result = userProfileSchema.safeParse({
      ...validProfile,
      id: 'not-a-uuid',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid tier', () => {
    const result = userProfileSchema.safeParse({
      ...validProfile,
      tier: 'enterprise',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid role', () => {
    const result = userProfileSchema.safeParse({
      ...validProfile,
      role: 'superadmin',
    })
    expect(result.success).toBe(false)
  })
})
