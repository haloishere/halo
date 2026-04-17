import { Redirect } from 'expo-router'
import { YStack, Spinner, useTheme } from 'tamagui'
import { useAuthStore } from '../src/stores/auth'

export default function RootIndex() {
  const { user, dbUser, isLoading } = useAuthStore()
  const theme = useTheme()

  if (isLoading) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center" backgroundColor="$background">
        <Spinner size="large" color={String(theme.accent9)} />
      </YStack>
    )
  }

  if (!user) return <Redirect href="/(auth)/enter-email" />
  if (!dbUser?.onboardingCompleted) return <Redirect href="/(onboarding)/welcome" />
  return <Redirect href="/(tabs)/" />
}
