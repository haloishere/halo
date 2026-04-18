import { describe, it, expect } from 'vitest'
import { onboardingSchema, userProfileSchema } from '../user'

describe('onboardingSchema', () => {
  it('accepts the full Halo shape (displayName + city)', () => {
    const result = onboardingSchema.safeParse({ displayName: 'Jane Doe', city: 'Luzern' })
    expect(result.success).toBe(true)
  })

  it('accepts an empty object (all fields optional)', () => {
    const result = onboardingSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('accepts displayName alone', () => {
    const result = onboardingSchema.safeParse({ displayName: 'Jane Doe' })
    expect(result.success).toBe(true)
  })

  it('accepts city alone', () => {
    const result = onboardingSchema.safeParse({ city: 'Luzern' })
    expect(result.success).toBe(true)
  })

  it('rejects a displayName with disallowed characters', () => {
    const result = onboardingSchema.safeParse({ displayName: 'Jane<script>' })
    expect(result.success).toBe(false)
  })

  it('rejects an empty-string city', () => {
    const result = onboardingSchema.safeParse({ city: '' })
    expect(result.success).toBe(false)
  })

  it('rejects a city exceeding max length', () => {
    const result = onboardingSchema.safeParse({ city: 'a'.repeat(101) })
    expect(result.success).toBe(false)
  })
})

describe('userProfileSchema', () => {
  const validProfile = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    email: 'user@example.com',
    displayName: 'Jane Doe',
    tier: 'free',
    role: 'user',
    city: 'Luzern',
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
      city: null,
      onboardingCompleted: null,
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid uuid', () => {
    const result = userProfileSchema.safeParse({ ...validProfile, id: 'not-a-uuid' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid tier', () => {
    const result = userProfileSchema.safeParse({ ...validProfile, tier: 'enterprise' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid role', () => {
    const result = userProfileSchema.safeParse({ ...validProfile, role: 'superadmin' })
    expect(result.success).toBe(false)
  })
})
