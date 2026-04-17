import { useState, useEffect, useCallback, useRef } from 'react'
import { router, useLocalSearchParams } from 'expo-router'
import { YStack, Heading, SizableText } from 'tamagui'
import { signInWithCustomToken } from 'firebase/auth'
import { auth } from '../../src/lib/firebase'
import { getAuthErrorMessage } from '../../src/lib/auth-errors'
import { useVerifyOtpMutation, useSendOtpMutation } from '../../src/api/otp'
import {
  Button,
  OtpInput,
  ScreenContainer,
  BrandLogo,
  ThemeIconToggle,
} from '../../src/components/ui'

const RESEND_COOLDOWN_SECONDS = 30

function maskEmail(email: string): string {
  const [localPart, domain] = email.split('@')
  if (!localPart || !domain) return email
  const visible = localPart.slice(0, 1)
  return `${visible}${'*'.repeat(Math.max(localPart.length - 1, 2))}@${domain}`
}

export default function VerifyCodeScreen() {
  const { email } = useLocalSearchParams<{ email: string }>()
  const verifyOtp = useVerifyOtpMutation()
  const sendOtp = useSendOtpMutation()
  const isVerifying = useRef(false)
  const [error, setError] = useState<string | undefined>()
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS)

  useEffect(() => {
    if (!email) {
      router.replace('/(auth)/enter-email')
    }
  }, [email])

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  if (!email) return null

  const handleCodeComplete = useCallback(
    async (code: string) => {
      if (isVerifying.current) return
      isVerifying.current = true
      setError(undefined)
      try {
        const result = await verifyOtp.mutateAsync({ email, code })
        await signInWithCustomToken(auth, result.customToken)
        // onAuthStateChanged in useAuth will handle navigation via AuthGuard
      } catch (err) {
        setError(getAuthErrorMessage(err) ?? undefined)
      } finally {
        isVerifying.current = false
      }
    },
    [email, verifyOtp.mutateAsync],
  )

  async function handleResend() {
    if (cooldown > 0) return
    setCooldown(RESEND_COOLDOWN_SECONDS)
    setError(undefined)
    try {
      await sendOtp.mutateAsync({ email })
    } catch (err) {
      setError(getAuthErrorMessage(err) ?? undefined)
    }
  }

  return (
    <ScreenContainer>
      {/* Theme toggle — pinned top right */}
      <YStack alignItems="flex-end">
        <ThemeIconToggle />
      </YStack>

      <YStack gap="$6" paddingTop="$6">
        {/* Brand */}
        <YStack alignItems="center">
          <BrandLogo animated={false} />
        </YStack>

        {/* Heading */}
        <YStack alignItems="center" gap="$2">
          <Heading size="$8" color="$color">
            Enter verification code
          </Heading>
          <SizableText size="$5" color="$color6" textAlign="center">
            Code sent to {maskEmail(email)}
          </SizableText>
        </YStack>

        {/* OTP Input */}
        <YStack gap="$4" alignItems="center">
          <OtpInput onComplete={handleCodeComplete} error={error} />
        </YStack>

        {/* Resend */}
        <YStack gap="$3" alignItems="center">
          <Button
            label={cooldown > 0 ? `Resend code (${cooldown}s)` : 'Resend code'}
            onPress={handleResend}
            disabled={cooldown > 0}
          />

          <SizableText
            size="$4"
            color="$accent11"
            onPress={() => router.back()}
            paddingVertical="$2"
          >
            Use a different email
          </SizableText>
        </YStack>
      </YStack>
    </ScreenContainer>
  )
}
