/**
 * Welcome greeting shown in an empty chat (0 messages, no pending send,
 * not streaming). Renders an animated avatar above a time-of-day greeting;
 * greeting copy and displayName-fallback logic are delegated to the pure
 * `buildGreeting` helper in `src/lib/chat-greeting.ts` and tested there.
 *
 * Animation behaviour:
 * - Pauses when the screen loses focus (`useIsFocused`) so the Lottie
 *   bridge stops running on background tabs.
 * - Respects the OS Reduce Motion accessibility setting (`useReducedMotion`).
 *
 * Timezone: the helper reads `new Date().getHours()`, which is the
 * device's local timezone. See chat-greeting.ts's file header comment
 * for why we intentionally don't use an account-level timezone.
 */
import { useIsFocused } from '@react-navigation/native'
import LottieView, { type AnimationObject } from 'lottie-react-native'
import { View } from 'react-native'
import { useReducedMotion } from 'react-native-reanimated'
import { YStack, SizableText } from 'tamagui'
import femaleAvatarRaw from '../../../assets/female-avatar.json'
import { buildGreeting } from '../../lib/chat-greeting'

const femaleAvatar = femaleAvatarRaw as unknown as AnimationObject

export interface WelcomeGreetingProps {
  /** Caregiver's full display name from `useAuthStore.dbUser?.displayName`.
   *  Null/undefined is valid — it falls back to "there" via `buildGreeting`. */
  displayName: string | null | undefined
}

export function WelcomeGreeting({ displayName }: WelcomeGreetingProps) {
  const { title, subtitle } = buildGreeting(displayName)
  const isFocused = useIsFocused()
  const reduceMotion = useReducedMotion()
  const shouldAnimate = isFocused && !reduceMotion

  return (
    <YStack flex={1} alignItems="center" justifyContent="center" gap="$1" padding="$6">
      <View
        testID="lottie-avatar-wrapper"
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        <LottieView
          source={femaleAvatar}
          autoPlay={shouldAnimate}
          loop={shouldAnimate}
          style={{ width: '100%', maxWidth: 300, aspectRatio: 1, marginBottom: -40 }}
          resizeMode="contain"
        />
      </View>
      <SizableText size="$8" color="$color" textAlign="center" fontWeight="700">
        {title}
      </SizableText>
      <SizableText size="$4" color="$color10" textAlign="center">
        {subtitle}
      </SizableText>
    </YStack>
  )
}
