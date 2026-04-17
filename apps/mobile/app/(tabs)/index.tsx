import { router } from 'expo-router'
import { Paragraph, YStack } from 'tamagui'
import { MessageSquare, Sparkles } from '@tamagui/lucide-icons'
import { AnimatedScreen, BrandLogo, Button, Chip } from '../../src/components/ui'

const PROMPT_SUGGESTIONS = [
  'Dinner in Luzern tonight',
  'Something cozy for two',
  'Quiet cafe to work from',
  'Activity for a rainy Sunday',
]

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
          <Paragraph size="$3" color="$color9" fontWeight="600">
            Try asking
          </Paragraph>
          <YStack gap="$2" flexWrap="wrap" flexDirection="row">
            {PROMPT_SUGGESTIONS.map((p) => (
              <Chip key={p} onPress={() => router.push(`/(tabs)/ai-chat?prompt=${encodeURIComponent(p)}`)}>
                {p}
              </Chip>
            ))}
          </YStack>
        </YStack>

        <YStack flex={1} justifyContent="flex-end" gap="$3">
          <Button
            size="$5"
            onPress={() => router.push('/(tabs)/ai-chat')}
            icon={MessageSquare as never}
          >
            Start a conversation
          </Button>
          <Button
            size="$5"
            variant="outlined"
            onPress={() => router.push('/(tabs)/vault')}
            icon={Sparkles as never}
          >
            Browse your vault
          </Button>
        </YStack>
      </YStack>
    </AnimatedScreen>
  )
}
