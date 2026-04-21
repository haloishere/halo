import { router } from 'expo-router'
import { Paragraph, SizableText, XStack, YStack } from 'tamagui'
import { MessageSquare, Sparkles } from '@tamagui/lucide-icons'
import { AnimatedScreen, BrandLogo, Button } from '../../src/components/ui'

const PROMPT_SUGGESTIONS = [
  'Dinner tonight',
  'Something cozy for two',
  'Quiet cafe to work from',
  'Activity for a rainy Sunday',
]

const PILL_BORDER_RADIUS = 999

export default function HomeScreen() {
  return (
    <AnimatedScreen>
      <YStack flex={1} backgroundColor="$background" padding="$6" gap="$6">
        <YStack alignItems="center" marginTop="$8" gap="$4">
          <BrandLogo size="$16" animated={false} />
          <Paragraph size="$5" color="$color10" textAlign="center" maxWidth={320}>
            Your personal AI vault. Ask anything — I know what you like.
          </Paragraph>
        </YStack>

        <YStack gap="$3" marginTop="$4">
          <SizableText size="$3" color="$color9" fontWeight="600">
            Try asking
          </SizableText>
          <XStack gap="$2" flexWrap="wrap">
            {PROMPT_SUGGESTIONS.map((p) => (
              <YStack
                key={p}
                paddingHorizontal="$3"
                paddingVertical="$2"
                borderRadius={PILL_BORDER_RADIUS}
                borderWidth={1}
                borderColor="$color5"
                backgroundColor="$color2"
                pressStyle={{ opacity: 0.85 }}
                onPress={() => router.push(`/(tabs)/ai-chat?prompt=${encodeURIComponent(p)}`)}
                accessibilityRole="button"
                accessibilityLabel={p}
              >
                <SizableText size="$3" color="$color">
                  {p}
                </SizableText>
              </YStack>
            ))}
          </XStack>
        </YStack>

        <YStack flex={1} justifyContent="flex-end" gap="$3">
          <Button
            label="Start a conversation"
            onPress={() => router.push('/(tabs)/ai-chat')}
            icon={<MessageSquare size={18} />}
          />
          <Button
            label="Browse your vault"
            variant="outline"
            onPress={() => router.push('/(tabs)/vault')}
            icon={<Sparkles size={18} />}
          />
        </YStack>
      </YStack>
    </AnimatedScreen>
  )
}
