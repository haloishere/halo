import { useRef } from 'react'
import { ScrollView } from 'react-native'
import { router } from 'expo-router'
import { Paragraph, SizableText, Theme, XStack, YStack } from 'tamagui'
import { MessageSquare, Sparkles } from '@tamagui/lucide-icons'
import LottieView, { type AnimationObject } from 'lottie-react-native'
import type { VaultTopic } from '@halo/shared'
import { AnimatedScreen, Button } from '../../src/components/ui'
import loadingOrbRaw from '../../assets/loading-orb.json'

const loadingOrb = loadingOrbRaw as unknown as AnimationObject

type Chip = { label: string; topic: VaultTopic }

const PROMPT_ROWS: Chip[][] = [
  [
    { label: 'Dinner tonight', topic: 'food_and_restaurants' },
    { label: 'Best ramen in town', topic: 'food_and_restaurants' },
    { label: 'Outfit for a date', topic: 'fashion' },
    { label: 'Weekend getaway', topic: 'lifestyle_and_travel' },
    { label: 'Late night eats', topic: 'food_and_restaurants' },
    { label: 'Sneaker drops this week', topic: 'fashion' },
    { label: 'Tasting menu experience', topic: 'food_and_restaurants' },
    { label: 'Solo travel destinations', topic: 'lifestyle_and_travel' },
  ],
  [
    { label: 'Something cozy for two', topic: 'food_and_restaurants' },
    { label: 'Brunch this weekend', topic: 'food_and_restaurants' },
    { label: 'Summer wardrobe', topic: 'fashion' },
    { label: 'Best coffee in town', topic: 'food_and_restaurants' },
    { label: 'Vegan spots nearby', topic: 'food_and_restaurants' },
    { label: 'Vintage shops nearby', topic: 'fashion' },
    { label: 'Budget travel hacks', topic: 'lifestyle_and_travel' },
    { label: 'Date night ideas', topic: 'lifestyle_and_travel' },
  ],
  [
    { label: 'Quiet cafe to work from', topic: 'food_and_restaurants' },
    { label: 'Hidden gem restaurants', topic: 'food_and_restaurants' },
    { label: 'Streetwear finds', topic: 'fashion' },
    { label: 'Weekend trip ideas', topic: 'lifestyle_and_travel' },
    { label: 'Rainy day plans', topic: 'lifestyle_and_travel' },
    { label: 'Morning routine tips', topic: 'lifestyle_and_travel' },
    { label: 'Digital detox spots', topic: 'lifestyle_and_travel' },
  ],
]

const PILL_BORDER_RADIUS = 999
const ORB_SIZE = 180

export default function HomeScreen() {
  const lottieRef = useRef<LottieView>(null)

  return (
    <AnimatedScreen>
      <YStack flex={1} backgroundColor="$background" padding="$6" gap="$6">
        <YStack alignItems="center" marginTop="$8" gap="$4">
          <LottieView
            ref={lottieRef}
            source={loadingOrb}
            autoPlay
            loop
            speed={0.6}
            style={{ width: ORB_SIZE, height: ORB_SIZE }}
            resizeMode="contain"
          />
          <Paragraph size="$5" color="$color10" textAlign="center" maxWidth={320}>
            Your personal AI memory.{'\n'}I remember you and what you like.
          </Paragraph>
        </YStack>

        <YStack gap="$3">
          <SizableText size="$3" color="$color9" fontWeight="600">
            Try asking
          </SizableText>
          <Theme name="accent">
            <YStack gap="$4">
              {PROMPT_ROWS.map((row, i) => (
                <ScrollView
                  key={i}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginHorizontal: -24 }}
                  contentContainerStyle={{ gap: 8, paddingHorizontal: 24 }}
                >
                  {row.map((chip) => (
                    <YStack
                      key={chip.label}
                      paddingHorizontal="$3"
                      paddingVertical="$2"
                      borderRadius={PILL_BORDER_RADIUS}
                      backgroundColor="$color1"
                      borderWidth={1}
                      borderColor="$color7"
                      pressStyle={{ opacity: 0.85 }}
                      onPress={() =>
                        router.push(
                          `/(tabs)/ai-chat?prompt=${encodeURIComponent(chip.label)}&topic=${chip.topic}`,
                        )
                      }
                      accessibilityRole="button"
                      accessibilityLabel={chip.label}
                    >
                      <SizableText size="$3" color="$color9" fontWeight="600">
                        {chip.label}
                      </SizableText>
                    </YStack>
                  ))}
                </ScrollView>
              ))}
            </YStack>
          </Theme>
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
