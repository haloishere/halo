import { useState, useEffect } from 'react'
import { router } from 'expo-router'
import { signOut } from 'firebase/auth'
import { styled, YStack, Heading, SizableText } from 'tamagui'
import { useToastController } from '@tamagui/toast'
import { useSendOtpMutation } from '../../src/api/otp'
import { useGoogleSignInMutation } from '../../src/api/google-auth'
import { getAuthErrorMessage } from '../../src/lib/auth-errors'
import { useAuthStore } from '../../src/stores/auth'
import { auth } from '../../src/lib/firebase'
import {
  Button,
  Input,
  Divider,
  ScreenContainer,
  BrandLogo,
  ThemeIconToggle,
} from '../../src/components/ui'
import { GoogleIcon } from '../../src/components/icons/GoogleIcon'

const FadeInStack = styled(YStack, {
  transition: 'quick',
  enterStyle: { opacity: 0, y: 10 },
  opacity: 1,
  y: 0,
})

export default function EnterEmailScreen() {
  const [email, setEmail] = useState('')
  const sendOtp = useSendOtpMutation()
  const googleSignIn = useGoogleSignInMutation()
  const toastCtrl = useToastController()
  const { syncError, user, isLoading } = useAuthStore()

  const [submitted, setSubmitted] = useState(false)
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false)

  // Show toast when useAuth sets a sync error (e.g. register failed after Google sign-in)
  useEffect(() => {
    if (syncError) {
      toastCtrl.show('Account Setup Failed', { message: syncError })
    }
  }, [syncError, toastCtrl])

  // Re-enable the Google button when Firebase auth itself failed (no user) OR
  // when Firebase succeeded but the server sync failed (user set + syncError).
  // On success the screen unmounts via navigation, so no reset is needed.
  // isGoogleSigningIn is intentionally excluded from deps: including it would
  // fire the effect on button press and immediately reset the flag.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (isGoogleSigningIn && !isLoading && (!user || syncError)) setIsGoogleSigningIn(false)
  }, [isLoading, user, syncError])

  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim())

  const emailError =
    submitted && (!email.trim() || !isValidEmail(email))
      ? 'Please enter a valid email address.'
      : undefined

  async function handleContinue() {
    setSubmitted(true)
    if (!email.trim() || !isValidEmail(email)) return
    try {
      await sendOtp.mutateAsync({ email: email.trim() })
      router.push({
        pathname: '/(auth)/verify-code',
        params: { email: email.trim() },
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong'
      const title = message.includes('Network error')
        ? 'Connection Problem'
        : message.includes('verification email')
          ? 'Email Not Sent'
          : 'Error'
      toastCtrl.show(title, { message })
    }
  }

  async function handleGoogleLogin() {
    // If a previous Google sign-in left a Firebase user without a DB record,
    // sign out first so we get a fresh onAuthStateChanged cycle
    if (user && !useAuthStore.getState().dbUser) {
      await signOut(auth).catch((err) => {
        if (__DEV__) console.warn('Sign out stale user failed:', err)
      })
    }
    setIsGoogleSigningIn(true)
    try {
      const result = await googleSignIn.mutateAsync()
      if (result === null) {
        setIsGoogleSigningIn(false)
        return
      }
      // Don't reset here — isLoading takes over until navigation unmounts this screen
    } catch (err) {
      setIsGoogleSigningIn(false)
      const message = getAuthErrorMessage(err)
      if (message) toastCtrl.show('Sign-In Failed', { message })
    }
  }

  return (
    <ScreenContainer>
      {/* Theme toggle — pinned top right */}
      <YStack alignItems="flex-end">
        <ThemeIconToggle />
      </YStack>

      <FadeInStack marginTop="$6">
        {/* Brand */}
        <YStack alignItems="center" marginBottom="$2">
          <BrandLogo />
        </YStack>

        {/* Heading */}
        <YStack alignItems="center" marginBottom="$6">
          <Heading size="$8" color="$color">
            Your Personal Ai Memory
          </Heading>
        </YStack>

        {/* Form */}
        <YStack gap="$3" marginBottom="$5">
          <Input
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            returnKeyType="go"
            onSubmitEditing={handleContinue}
            accessibilityLabel="Email address"
            error={emailError}
          />

          <Button label="Continue" onPress={handleContinue} loading={sendOtp.isPending} />
        </YStack>

        {/* Social */}
        <YStack gap="$3">
          <Divider label="or" />
          <Button
            label="Continue with Google"
            onPress={handleGoogleLogin}
            variant="outline"
            icon={<GoogleIcon />}
            loading={isGoogleSigningIn}
          />
        </YStack>
      </FadeInStack>
    </ScreenContainer>
  )
}
