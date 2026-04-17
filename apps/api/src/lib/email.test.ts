import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockSend = vi.fn()

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}))

const { sendOtpEmail } = await import('./email.js')

describe('sendOtpEmail', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.RESEND_API_KEY = 're_test_key'
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('returns early in test mode (NODE_ENV=test)', async () => {
    process.env.NODE_ENV = 'test'

    await sendOtpEmail({ to: 'user@example.com', code: '123456' })

    expect(mockSend).not.toHaveBeenCalled()
  })

  it('returns early when OTP_TEST_MODE is true in development', async () => {
    process.env.NODE_ENV = 'development'
    process.env.OTP_TEST_MODE = 'true'

    await sendOtpEmail({ to: 'user@example.com', code: '123456' })

    expect(mockSend).not.toHaveBeenCalled()
  })

  it('throws if OTP_TEST_MODE=true in production', async () => {
    process.env.NODE_ENV = 'production'
    process.env.OTP_TEST_MODE = 'true'

    await expect(sendOtpEmail({ to: 'user@example.com', code: '123456' })).rejects.toThrow(
      'OTP_TEST_MODE must not be enabled in production',
    )
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('throws when Resend API returns error response', async () => {
    process.env.NODE_ENV = 'production'
    delete process.env.OTP_TEST_MODE
    mockSend.mockResolvedValue({
      data: null,
      error: { message: 'Invalid API key', name: 'validation_error' },
    })

    await expect(sendOtpEmail({ to: 'user@example.com', code: '123456' })).rejects.toThrow(
      'Failed to send OTP email: Invalid API key',
    )
  })

  it('succeeds when Resend API returns no error', async () => {
    process.env.NODE_ENV = 'production'
    delete process.env.OTP_TEST_MODE
    mockSend.mockResolvedValue({
      data: { id: 'email-id' },
      error: null,
    })

    await expect(sendOtpEmail({ to: 'user@example.com', code: '123456' })).resolves.toBeUndefined()
  })
})
