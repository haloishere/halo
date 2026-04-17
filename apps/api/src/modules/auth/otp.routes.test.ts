import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createTestApp } from '../../test/helpers.js'
import { createUserFactory } from '../../test/factories/index.js'
import { EmailDeliveryError } from '../../lib/errors.js'

const { mockCreateOtp, mockVerifyOtp, mockCleanupExpiredOtps } = vi.hoisted(() => ({
  mockCreateOtp: vi.fn(),
  mockVerifyOtp: vi.fn(),
  mockCleanupExpiredOtps: vi.fn(),
}))

vi.mock('./otp.service.js', () => ({
  createOtp: mockCreateOtp,
  verifyOtp: mockVerifyOtp,
  cleanupExpiredOtps: mockCleanupExpiredOtps,
}))

async function buildOtpApp() {
  const app = await createTestApp()
  app.decorate('db', {} as never)
  const otpRoutes = (await import('./otp.routes.js')).default
  await app.register(otpRoutes, { prefix: '/v1/auth/otp' })
  return app
}

describe('POST /v1/auth/otp/send', () => {
  let app: Awaited<ReturnType<typeof buildOtpApp>>

  beforeEach(async () => {
    vi.clearAllMocks()
    app = await buildOtpApp()
  })

  it('returns 200 with success message for valid email', async () => {
    mockCreateOtp.mockResolvedValue(undefined)

    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/otp/send',
      payload: { email: 'user@example.com' },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.success).toBe(true)
    expect(body.message).toBeDefined()
  })

  it('calls createOtp with normalized email', async () => {
    mockCreateOtp.mockResolvedValue(undefined)

    await app.inject({
      method: 'POST',
      url: '/v1/auth/otp/send',
      payload: { email: 'User@Example.COM' },
    })

    // Zod transform lowercases + trims the email before it reaches the handler
    expect(mockCreateOtp).toHaveBeenCalledWith(
      expect.anything(), // db
      'user@example.com',
      expect.any(String), // ip
      expect.anything(), // user-agent
    )
  })

  it('returns 400 for invalid email', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/otp/send',
      payload: { email: 'not-an-email' },
    })

    expect(response.statusCode).toBe(400)
  })

  it('returns 400 when email is missing', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/otp/send',
      payload: {},
    })

    expect(response.statusCode).toBe(400)
  })

  it('returns 200 even when createOtp fails (no user enumeration)', async () => {
    mockCreateOtp.mockRejectedValue(new Error('DB error'))

    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/otp/send',
      payload: { email: 'user@example.com' },
    })

    // Always return 200 to prevent user enumeration
    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.success).toBe(true)
  })

  it('returns 500 when email delivery fails (Resend API error)', async () => {
    mockCreateOtp.mockRejectedValue(
      new EmailDeliveryError('Failed to send OTP email: domain not verified'),
    )

    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/otp/send',
      payload: { email: 'user@example.com' },
    })

    expect(response.statusCode).toBe(500)
    const body = response.json()
    expect(body.success).toBe(false)
    expect(body.error).toBe('Unable to send verification email. Please try again later.')
  })

  it('returns 500 when email delivery fails (SDK exception)', async () => {
    mockCreateOtp.mockRejectedValue(
      new EmailDeliveryError('Failed to send OTP email: network timeout'),
    )

    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/otp/send',
      payload: { email: 'user@example.com' },
    })

    expect(response.statusCode).toBe(500)
    const body = response.json()
    expect(body.success).toBe(false)
    expect(body.error).not.toContain('network timeout')
  })
})

describe('POST /v1/auth/otp/verify', () => {
  let app: Awaited<ReturnType<typeof buildOtpApp>>

  beforeEach(async () => {
    vi.clearAllMocks()
    app = await buildOtpApp()
  })

  it('returns 200 with customToken and user on valid code', async () => {
    const user = createUserFactory()
    mockVerifyOtp.mockResolvedValue({ customToken: 'mock-token', user })

    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/otp/verify',
      payload: { email: 'user@example.com', code: '123456' },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.success).toBe(true)
    expect(body.data.customToken).toBe('mock-token')
    expect(body.data.user.id).toBe(user.id)
  })

  it('returns 400 for invalid code format (non-numeric)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/otp/verify',
      payload: { email: 'user@example.com', code: 'abcdef' },
    })

    expect(response.statusCode).toBe(400)
  })

  it('returns 400 for code with wrong length', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/otp/verify',
      payload: { email: 'user@example.com', code: '123' },
    })

    expect(response.statusCode).toBe(400)
  })

  it('returns 400 when code is missing', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/otp/verify',
      payload: { email: 'user@example.com' },
    })

    expect(response.statusCode).toBe(400)
  })

  it('returns 401 with allowlisted message on wrong/expired/locked code', async () => {
    mockVerifyOtp.mockRejectedValue(Object.assign(new Error('Invalid code'), { statusCode: 401 }))

    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/otp/verify',
      payload: { email: 'user@example.com', code: '999999' },
    })

    expect(response.statusCode).toBe(401)
    const body = response.json()
    expect(body.success).toBe(false)
    expect(body.error).toBe('Invalid code')
  })

  it('returns generic 401 message for non-allowlisted errors', async () => {
    mockVerifyOtp.mockRejectedValue(
      Object.assign(new Error('Firebase internal: user pool exhausted'), { statusCode: 401 }),
    )

    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/otp/verify',
      payload: { email: 'user@example.com', code: '123456' },
    })

    expect(response.statusCode).toBe(401)
    const body = response.json()
    expect(body.success).toBe(false)
    expect(body.error).toBe('Verification failed')
    expect(body.error).not.toContain('Firebase')
  })

  it('returns 500 on unexpected server error without leaking internals', async () => {
    mockVerifyOtp.mockRejectedValue(new Error('DB connection lost: host=10.0.0.5'))

    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/otp/verify',
      payload: { email: 'user@example.com', code: '123456' },
    })

    expect(response.statusCode).toBe(500)
    const body = response.json()
    expect(body.success).toBe(false)
    // Global error handler must NOT expose internal details
    expect(body.error).not.toContain('DB connection')
    expect(body.error).not.toContain('10.0.0.5')
  })

  it('surfaces 429 rate-limit on /send', async () => {
    mockCreateOtp.mockRejectedValue(
      Object.assign(new Error('Too many codes requested'), { statusCode: 429 }),
    )

    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/otp/send',
      payload: { email: 'user@example.com' },
    })

    expect(response.statusCode).toBe(429)
    const body = response.json()
    expect(body.success).toBe(false)
  })
})

describe('DELETE /v1/auth/otp/cleanup', () => {
  let app: Awaited<ReturnType<typeof buildOtpApp>>
  const CLEANUP_SECRET = 'test-cleanup-secret-value'

  beforeEach(async () => {
    vi.clearAllMocks()
    process.env.CLEANUP_SECRET = CLEANUP_SECRET
    app = await buildOtpApp()
  })

  it('returns 200 with deleted count on valid secret', async () => {
    mockCleanupExpiredOtps.mockResolvedValue(42)

    const response = await app.inject({
      method: 'DELETE',
      url: '/v1/auth/otp/cleanup',
      headers: { 'x-cleanup-secret': CLEANUP_SECRET },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.success).toBe(true)
    expect(body.data.deleted).toBe(42)
  })

  it('returns 403 when secret header is missing', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: '/v1/auth/otp/cleanup',
    })

    expect(response.statusCode).toBe(403)
    expect(mockCleanupExpiredOtps).not.toHaveBeenCalled()
  })

  it('returns 403 when secret header is wrong', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: '/v1/auth/otp/cleanup',
      headers: { 'x-cleanup-secret': 'wrong-secret' },
    })

    expect(response.statusCode).toBe(403)
    expect(mockCleanupExpiredOtps).not.toHaveBeenCalled()
  })

  it('returns 500 when CLEANUP_SECRET env var is not set', async () => {
    delete process.env.CLEANUP_SECRET

    const response = await app.inject({
      method: 'DELETE',
      url: '/v1/auth/otp/cleanup',
      headers: { 'x-cleanup-secret': 'any-value' },
    })

    expect(response.statusCode).toBe(500)
  })
})
