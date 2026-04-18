import { useEffect, useRef } from 'react'
import { useWindowDimensions } from 'react-native'
import { YStack, Heading, SizableText } from 'tamagui'
import LottieView, { type AnimationObject } from 'lottie-react-native'

export interface IntroSlideProps {
  source: AnimationObject
  eyebrow: string
  headline: string
  body: string
  active: boolean
}

// Fixed square hero so every Lottie occupies the same visual footprint,
// regardless of its canvas aspect ratio (e.g. 800x600 vs 1500x1500).
// Capped by both viewport width AND height so small phones don't see
// the animation collide with the footer CTA.
const HERO_WIDTH_RATIO = 0.82
const HERO_HEIGHT_RATIO = 0.38
const HERO_MAX = 340

export function IntroSlide({ source, eyebrow, headline, body, active }: IntroSlideProps) {
  const { width, height } = useWindowDimensions()
  const heroSize = Math.min(width * HERO_WIDTH_RATIO, height * HERO_HEIGHT_RATIO, HERO_MAX)
  const lottieRef = useRef<LottieView>(null)

  useEffect(() => {
    const view = lottieRef.current
    if (!view) return
    if (active) {
      view.reset()
      view.play()
    } else {
      view.pause()
    }
  }, [active])

  return (
    <YStack width={width} flex={1} paddingHorizontal="$6">
      <YStack gap="$3" paddingTop="$8">
        <SizableText size="$2" color="$color10" letterSpacing={3}>
          {eyebrow.toUpperCase()}
        </SizableText>

        <Heading size="$10" lineHeight="$10" letterSpacing={-0.5}>
          {headline}
        </Heading>

        <SizableText size="$5" color="$color11" lineHeight="$6">
          {body}
        </SizableText>
      </YStack>

      <YStack flex={1} alignItems="center" justifyContent="center" paddingBottom="$4">
        <YStack
          width={heroSize}
          height={heroSize}
          alignItems="center"
          justifyContent="center"
          overflow="hidden"
        >
          <LottieView
            ref={lottieRef}
            source={source}
            loop
            autoPlay={false}
            resizeMode="cover"
            style={{ width: heroSize, height: heroSize }}
          />
        </YStack>
      </YStack>
    </YStack>
  )
}
