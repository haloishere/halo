import Animated from 'react-native-reanimated'
import { YStack, SizableText } from 'tamagui'
import { HaloAiLogo } from '../ui/HaloAiLogo'
import { useBlinkAnimation } from '../../hooks/useBlinkAnimation'

/**
 * Shown inside the assistant bubble while `isStreaming` is true but no
 * content has arrived yet (bot is processing / "thinking").
 *
 * Renders the animated Halo logo (same asset as the CTA tab button)
 * above a softly blinking "Halo is thinking…" label.
 */
export function ThinkingIndicator() {
  const animatedStyle = useBlinkAnimation(0.25, 550)

  return (
    <YStack alignItems="center" gap="$2" paddingVertical="$1">
      <HaloAiLogo size={52} loop autoPlay />
      <Animated.View
        testID="thinking-label"
        style={animatedStyle}
        accessibilityLiveRegion="polite"
        accessibilityLabel="Halo is thinking"
      >
        <SizableText size="$3" color="$accent9">
          Halo is thinking…
        </SizableText>
      </Animated.View>
    </YStack>
  )
}
