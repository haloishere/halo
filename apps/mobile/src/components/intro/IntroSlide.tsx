import { useEffect, useRef } from 'react'
import { useWindowDimensions } from 'react-native'
import { YStack, XStack, Heading, SizableText, Separator } from 'tamagui'
import LottieView, { type AnimationObject } from 'lottie-react-native'

export interface IntroSlideProps {
  source: AnimationObject
  index: number
  total: number
  eyebrow: string
  headline: string
  body: string
  active: boolean
}

export function IntroSlide({
  source,
  index,
  total,
  eyebrow,
  headline,
  body,
  active,
}: IntroSlideProps) {
  const { width } = useWindowDimensions()
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

  const pad = (n: number) => n.toString().padStart(2, '0')

  return (
    <YStack width={width} flex={1} paddingHorizontal="$6">
      <YStack flex={1} alignItems="center" justifyContent="center" paddingTop="$6">
        <LottieView
          ref={lottieRef}
          source={source}
          loop
          autoPlay={false}
          resizeMode="contain"
          style={{ width: width * 0.82, height: width * 0.82 }}
        />
      </YStack>

      <YStack gap="$3" paddingBottom="$4">
        <XStack alignItems="center" gap="$3">
          <SizableText
            size="$2"
            fontFamily="$brand"
            color="$color11"
            letterSpacing={2}
          >
            {pad(index + 1)} / {pad(total)}
          </SizableText>
          <Separator flex={1} borderColor="$color6" />
          <SizableText size="$2" color="$color10" letterSpacing={3}>
            {eyebrow.toUpperCase()}
          </SizableText>
        </XStack>

        <Heading size="$10" lineHeight="$10" letterSpacing={-0.5}>
          {headline}
        </Heading>

        <SizableText size="$5" color="$color11" lineHeight="$6">
          {body}
        </SizableText>
      </YStack>
    </YStack>
  )
}
