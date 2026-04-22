import { useRef } from 'react'
import { ScrollView } from 'react-native'
import { router } from 'expo-router'
import { Paragraph, SizableText, Theme, XStack, YStack } from 'tamagui'
import { MessageSquare, Sparkles } from '@tamagui/lucide-icons'
import LottieView, { type AnimationObject } from 'lottie-react-native'
import { AnimatedScreen, Button } from '../../src/components/ui'
import loadingOrbRaw from '../../assets/loading-orb.json'

const loadingOrb = loadingOrbRaw as unknown as AnimationObject

const PROMPT_ROWS = [
  [
    'Dinner tonight',
    'Best ramen in town',
    'Outfit for a date',
    'Weekend getaway',
    'Late night eats',
    'Sneaker drops this week',
    'Tasting menu experience',
    'Solo travel destinations',
  ],
  [
    'Something cozy for two',
    'Brunch this weekend',
    'Summer wardrobe',
    'Best coffee in town',
    'Vegan spots nearby',
    'Vintage shops nearby',
    'Budget travel hacks',
    'Date night ideas',
  ],
  [
    'Quiet cafe to work from',
    'Hidden gem restaurants',
    'Streetwear finds',
    'Weekend trip ideas',
    'Rainy day plans',
    'Morning routine tips',
    'Digital detox spots',
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
                  {row.map((p) => (
                    <YStack
                      key={p}
                      paddingHorizontal="$3"
                      paddingVertical="$2"
                      borderRadius={PILL_BORDER_RADIUS}
                      backgroundColor="$color1"
                      borderWidth={1}
                      borderColor="$color7"
                      pressStyle={{ opacity: 0.85 }}
                      onPress={() => router.push(`/(tabs)/ai-chat?prompt=${encodeURIComponent(p)}`)}
                      accessibilityRole="button"
                      accessibilityLabel={p}
                    >
                      <SizableText size="$3" color="$color9" fontWeight="600">
                        {p}
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
