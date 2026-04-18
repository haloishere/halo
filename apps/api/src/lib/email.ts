import { Resend } from 'resend'
import { EmailDeliveryError } from './errors.js'

let resendClient: Resend | null = null

function getResendClient(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      throw new Error('RESEND_API_KEY environment variable is required')
    }
    resendClient = new Resend(apiKey)
  }
  return resendClient
}

export interface SendOtpEmailOptions {
  to: string
  code: string
}

/**
 * Send a 6-digit OTP verification code via email.
 *
 * In test mode (NODE_ENV=test or OTP_TEST_MODE=true), skips actual email
 * sending and returns immediately — allows unit/integration/E2E tests
 * without Resend API calls.
 */
export async function sendOtpEmail({ to, code }: SendOtpEmailOptions): Promise<void> {
  if (process.env.OTP_TEST_MODE === 'true') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('OTP_TEST_MODE must not be enabled in production')
    }
    return
  }
  if (process.env.NODE_ENV === 'test') {
    return
  }

  const resend = getResendClient()

  const fromAddress = process.env.OTP_FROM_EMAIL ?? 'Halo <noreply@haloapp.tech>'

  try {
    const { error } = await resend.emails.send({
      from: fromAddress,
      to,
      subject: 'Your Halo verification code',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 400px; margin: 0 auto; padding: 40px 20px;">
          <h2 style="color: #1a1a1a; margin-bottom: 8px;">Your verification code</h2>
          <p style="color: #666; margin-bottom: 24px;">Enter this code to sign in to Halo:</p>
          <div style="background: #f5f5f5; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
            <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #1a1a1a;">${code}</span>
          </div>
          <p style="color: #999; font-size: 13px;">This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
    })

    if (error) {
      throw new EmailDeliveryError(`Failed to send OTP email: ${error.message}`)
    }
  } catch (err) {
    if (err instanceof EmailDeliveryError) throw err
    throw new EmailDeliveryError(`Failed to send OTP email: ${(err as Error).message}`)
  }
}
