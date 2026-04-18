import { Redirect } from 'expo-router'
import { YStack, Spinner, useTheme } from 'tamagui'
import { useAuthStore } from '../src/stores/auth'
import { useIntroStore } from '../src/stores/intro'

export default function RootIndex() {
  const { user, dbUser, isLoading } = useAuthStore()
  const introHydrated = useIntroStore((s) => s.hydrated)
  const hasSeenIntro = useIntroStore((s) => s.hasSeen)
  const theme = useTheme()

  if (isLoading || !introHydrated) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center" backgroundColor="$background">
        <Spinner size="large" color={String(theme.accent9)} />
      </YStack>
    )
  }

  if (!hasSeenIntro) return <Redirect href="/intro" />
  if (!user) return <Redirect href="/(auth)/enter-email" />
  if (!dbUser?.onboardingCompleted) return <Redirect href="/(onboarding)/welcome" />
  return <Redirect href="/(tabs)/" />
}
