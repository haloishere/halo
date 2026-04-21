import { describe, it, expect } from 'vitest'
import { onboardingSchema, userProfileSchema } from '../user'

describe('onboardingSchema', () => {
  it('accepts the full Halo shape (displayName + city)', () => {
    const result = onboardingSchema.safeParse({ displayName: 'Jane Doe', city: 'Luzern' })
    expect(result.success).toBe(true)
  })

  it('rejects an empty object (at least one field required)', () => {
    const result = onboardingSchema.safeParse({})
    expect(result.success).toBe(false)
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

  it('accepts age at the GDPR floor (16)', () => {
    const result = onboardingSchema.safeParse({ age: 16 })
    expect(result.success).toBe(true)
  })

  it('accepts age at the ceiling (120)', () => {
    const result = onboardingSchema.safeParse({ age: 120 })
    expect(result.success).toBe(true)
  })

  it('rejects age below the GDPR floor', () => {
    const result = onboardingSchema.safeParse({ age: 15 })
    expect(result.success).toBe(false)
  })

  it('rejects age above the ceiling', () => {
    const result = onboardingSchema.safeParse({ age: 121 })
    expect(result.success).toBe(false)
  })

  it('rejects non-integer age', () => {
    const result = onboardingSchema.safeParse({ age: 25.5 })
    expect(result.success).toBe(false)
  })

  it('rejects negative age', () => {
    const result = onboardingSchema.safeParse({ age: -1 })
    expect(result.success).toBe(false)
  })

  it('accepts the full shape (displayName + age + city)', () => {
    const result = onboardingSchema.safeParse({
      displayName: 'Jane Doe',
      age: 42,
      city: 'Luzern, Switzerland',
    })
    expect(result.success).toBe(true)
  })
})

describe('userProfileSchema', () => {
  const validProfile = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    email: 'user@example.com',
    displayName: 'Jane Doe',
    tier: 'free',
    role: 'user',
    age: 42,
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
      age: null,
      city: null,
      onboardingCompleted: null,
    })
    expect(result.success).toBe(true)
  })

  it('accepts out-of-range age on the profile (DB CHECK is authoritative)', () => {
    // Read schema should tolerate what the DB can return, not re-enforce the
    // write-side invariants. The CHECK constraint in migration 0011 is the
    // authoritative gate — the profile schema only filters shape.
    const result = userProfileSchema.safeParse({ ...validProfile, age: 15 })
    expect(result.success).toBe(true)
  })

  it('still rejects non-integer age on the profile', () => {
    const result = userProfileSchema.safeParse({ ...validProfile, age: 25.5 })
    expect(result.success).toBe(false)
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

  it('rejects empty-string city (matches write-side validation)', () => {
    const result = userProfileSchema.safeParse({ ...validProfile, city: '' })
    expect(result.success).toBe(false)
  })
})
