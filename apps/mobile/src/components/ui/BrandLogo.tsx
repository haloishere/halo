import { useState, useEffect } from 'react'
import { XStack, Heading, Theme, type HeadingProps } from 'tamagui'

export interface BrandLogoProps {
  /** Tamagui size token for the text. Defaults to "$15". */
  size?: HeadingProps['size']
  /** Enable per-letter typing + fade animation. Defaults to true. */
  animated?: boolean
  /** Delay in ms between each letter. Defaults to 120. */
  typeDelay?: number
}

const BRAND = 'halo'

export function BrandLogo({ size = '$15', animated = true, typeDelay = 120 }: BrandLogoProps) {
  const [visibleCount, setVisibleCount] = useState(animated ? 0 : BRAND.length)

  useEffect(() => {
    if (!animated || visibleCount >= BRAND.length) return
    const timer = setTimeout(() => setVisibleCount((c) => c + 1), typeDelay)
    return () => clearTimeout(timer)
  }, [animated, visibleCount, typeDelay])

  return (
    <Theme name="accent">
      {animated ? (
        <XStack>
          {BRAND.split('').map((char, i) => (
            <Heading
              key={i}
              size={size}
              color="$color8"
              letterSpacing={-1}
              fontFamily="$grandHotel"
              opacity={i < visibleCount ? 1 : 0}
              transition="medium"
            >
              {char}
            </Heading>
          ))}
        </XStack>
      ) : (
        <Heading size={size} color="$color8" letterSpacing={-1} fontFamily="$grandHotel">
          {BRAND}
        </Heading>
      )}
    </Theme>
  )
}
