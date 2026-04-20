import { describe, it, expect } from 'vitest'
import { sendOtpSchema, verifyOtpSchema, otpVerifyResponseSchema } from '../otp'

describe('sendOtpSchema', () => {
  it('accepts valid email and normalizes to lowercase', () => {
    const result = sendOtpSchema.safeParse({ email: 'User@Example.COM' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.email).toBe('user@example.com')
  })

  it('normalizes mixed-case email', () => {
    const result = sendOtpSchema.safeParse({ email: 'Test.User@Gmail.COM' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.email).toBe('test.user@gmail.com')
  })

  it('rejects invalid email', () => {
    const result = sendOtpSchema.safeParse({ email: 'not-an-email' })
    expect(result.success).toBe(false)
  })

  it('rejects missing email', () => {
    const result = sendOtpSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

describe('verifyOtpSchema', () => {
  it('accepts valid email and 6-digit code', () => {
    const result = verifyOtpSchema.safeParse({
      email: 'user@example.com',
      code: '123456',
    })
    expect(result.success).toBe(true)
  })

  it('normalizes email to lowercase', () => {
    const result = verifyOtpSchema.safeParse({
      email: 'USER@Example.com',
      code: '000000',
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.email).toBe('user@example.com')
  })

  it('rejects non-numeric code', () => {
    const result = verifyOtpSchema.safeParse({
      email: 'user@example.com',
      code: 'abcdef',
    })
    expect(result.success).toBe(false)
  })

  it('rejects code with wrong length', () => {
    const result = verifyOtpSchema.safeParse({
      email: 'user@example.com',
      code: '123',
    })
    expect(result.success).toBe(false)
  })

  it('rejects 4-digit code (too short)', () => {
    const result = verifyOtpSchema.safeParse({
      email: 'user@example.com',
      code: '1234',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing code', () => {
    const result = verifyOtpSchema.safeParse({ email: 'user@example.com' })
    expect(result.success).toBe(false)
  })
})

describe('otpVerifyResponseSchema', () => {
  it('accepts valid response with user', () => {
    const result = otpVerifyResponseSchema.safeParse({
      customToken: 'firebase-custom-token-abc',
      user: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        email: 'user@example.com',
        displayName: 'Jane',
        tier: 'free',
        role: 'user',
        age: null,
        city: null,
        onboardingCompleted: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    })
    expect(result.success).toBe(true)
  })

  it('accepts valid response with null user (new user)', () => {
    const result = otpVerifyResponseSchema.safeParse({
      customToken: 'firebase-custom-token-abc',
      user: null,
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing customToken', () => {
    const result = otpVerifyResponseSchema.safeParse({ user: null })
    expect(result.success).toBe(false)
  })
})
