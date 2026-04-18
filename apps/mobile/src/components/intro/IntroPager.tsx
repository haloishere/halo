import { useCallback, useMemo, useRef, useState } from 'react'
import {
  ScrollView,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native'
import { YStack, XStack, SizableText, Theme } from 'tamagui'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { AnimationObject } from 'lottie-react-native'
import { Button } from '../ui'
import { IntroSlide } from './IntroSlide'

export interface IntroSlideContent {
  source: AnimationObject
  eyebrow: string
  headline: string
  body: string
}

export interface IntroPagerProps {
  slides: IntroSlideContent[]
  onFinish: () => void
  onSkip?: () => void
}

export function IntroPager({ slides, onFinish, onSkip }: IntroPagerProps) {
  const { width } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const scrollRef = useRef<ScrollView>(null)
  const [index, setIndex] = useState(0)

  const isLast = index === slides.length - 1
  const handleSkip = onSkip ?? onFinish

  const handleMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.round(e.nativeEvent.contentOffset.x / width)
      if (next !== index) setIndex(next)
    },
    [index, width],
  )

  const handleNext = useCallback(() => {
    if (isLast) return onFinish()
    const nextIndex = index + 1
    scrollRef.current?.scrollTo({ x: nextIndex * width, animated: true })
    setIndex(nextIndex)
  }, [isLast, index, width, onFinish])

  const dots = useMemo(() => slides.map((_, i) => i), [slides])

  return (
    <YStack flex={1} backgroundColor="$background">
      <XStack
        position="absolute"
        top={insets.top + 8}
        right="$5"
        zIndex={10}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        onPress={handleSkip}
        pressStyle={{ opacity: 0.6 }}
        accessible
        accessibilityRole="button"
        accessibilityLabel="Skip introduction"
      >
        <SizableText size="$3" color="$color11" letterSpacing={1.5}>
          SKIP
        </SizableText>
      </XStack>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumEnd}
        style={{ flex: 1, marginTop: insets.top }}
        contentContainerStyle={{ alignItems: 'stretch' }}
      >
        {slides.map((slide, i) => (
          <IntroSlide
            key={i}
            index={i}
            total={slides.length}
            source={slide.source}
            eyebrow={slide.eyebrow}
            headline={slide.headline}
            body={slide.body}
            active={i === index}
          />
        ))}
      </ScrollView>

      <YStack
        paddingHorizontal="$6"
        paddingTop="$4"
        paddingBottom={Math.max(insets.bottom, 24)}
        gap="$5"
      >
        <Theme name="accent">
          <XStack gap="$2" justifyContent="center" alignItems="center">
            {dots.map((i) => (
              <YStack
                key={i}
                height={6}
                width={i === index ? 28 : 6}
                borderRadius={3}
                backgroundColor={i === index ? '$color8' : '$color5'}
                // @ts-expect-error — Tamagui v2 RC: `animation` prop is valid at runtime but absent from YStack types
                animation="medium"
              />
            ))}
          </XStack>
        </Theme>

        <Button label={isLast ? 'Get started' : 'Continue'} onPress={handleNext} />
      </YStack>
    </YStack>
  )
}
