import { Stack, usePathname, router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { XStack, YStack, SizableText } from 'tamagui'
import { ProgressBar } from '../../src/components/ui'
import { BackIcon } from '../../src/components/icons/BackIcon'

const STEPS = [
  '/(onboarding)/welcome',
  '/(onboarding)/city',
  '/(onboarding)/consent',
]

function ProgressHeader() {
  const pathname = usePathname()
  const insets = useSafeAreaInsets()
  const currentStep = STEPS.findIndex((s) => pathname.includes(s.split('/').pop() ?? '')) + 1
  const canGoBack = currentStep > 1

  return (
    <YStack paddingTop={insets.top} backgroundColor="$background">
      {canGoBack && (
        <XStack
          paddingHorizontal="$4"
          paddingVertical="$3"
          alignItems="center"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={() => router.back()}
          pressStyle={{ opacity: 0.7 }}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <BackIcon />
          <SizableText size="$4" color="$color11" marginLeft="$1">
            Back
          </SizableText>
        </XStack>
      )}
      <ProgressBar currentStep={currentStep} totalSteps={STEPS.length} />
    </YStack>
  )
}

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        header: () => <ProgressHeader />,
        animation: 'slide_from_right',
      }}
    />
  )
}
