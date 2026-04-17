import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import { YStack } from 'tamagui'
import LottieView, { type AnimationObject } from 'lottie-react-native'
import haloAiLogoRaw from '../../../assets/halo-ai-logo.json'

const haloAiLogo = haloAiLogoRaw as unknown as AnimationObject

// Animation canvas bleeds ~87% beyond the circular clip boundary — preserves the original 112/60 framing.
const LOTTIE_OVERFLOW_RATIO = 1.87

export interface HaloAiLogoRef {
  play: () => void
  pause: () => void
}

export interface HaloAiLogoProps {
  /** Diameter of the circular container. Defaults to 60. */
  size?: number
  loop?: boolean
  autoPlay?: boolean
}

/**
 * Circular Lottie badge used in both the CTA tab button and the
 * AI thinking indicator. Exposes `play`/`pause` via ref for callers
 * that need fine-grained control (e.g. CtaTabItem).
 */
export const HaloAiLogo = forwardRef<HaloAiLogoRef, HaloAiLogoProps>(function HaloAiLogo(
  { size = 60, loop = false, autoPlay = false },
  ref,
) {
  const lottieRef = useRef<LottieView>(null)

  useImperativeHandle(ref, () => ({
    play: () => lottieRef.current?.play(),
    pause: () => lottieRef.current?.pause(),
  }))

  useEffect(() => {
    if (autoPlay) lottieRef.current?.play()
  }, [autoPlay])

  const lottieSize = size * LOTTIE_OVERFLOW_RATIO

  return (
    <YStack
      width={size}
      height={size}
      borderRadius={size / 2}
      backgroundColor="$accent9"
      overflow="hidden"
      alignItems="center"
      justifyContent="center"
    >
      <LottieView
        ref={lottieRef}
        source={haloAiLogo}
        loop={loop}
        style={{ width: lottieSize, height: lottieSize }}
        resizeMode="contain"
      />
    </YStack>
  )
})
