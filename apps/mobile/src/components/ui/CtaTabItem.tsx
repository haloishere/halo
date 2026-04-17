import { useRef, useEffect } from 'react'
import { Pressable } from 'react-native'
import { YStack, SizableText, Theme } from 'tamagui'
import { HaloAiLogo, type HaloAiLogoRef } from './HaloAiLogo'

// TODO(tamagui-v2-stable): Animation spread bypasses Tamagui v2 RC type gap on `animation` prop
const tabAnimProps = { animation: 'quick' } as Record<string, unknown>

const PRESSABLE_STYLE = { flex: 1, alignItems: 'center' as const, paddingVertical: 4 }
const PULSE_INTERVAL_MS = 15_000

interface CtaTabItemProps {
  label: string
  isFocused: boolean
  onPress: () => void
}

export function CtaTabItem({ label, isFocused, onPress }: CtaTabItemProps) {
  const logoRef = useRef<HaloAiLogoRef>(null)

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null

    if (isFocused) {
      logoRef.current?.pause()
    } else {
      logoRef.current?.play()
      intervalId = setInterval(() => {
        logoRef.current?.play()
      }, PULSE_INTERVAL_MS)
    }

    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [isFocused])

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isFocused }}
      style={PRESSABLE_STYLE}
    >
      <Theme name="accent">
        <YStack alignItems="center" gap="$1" scale={isFocused ? 1.08 : 1} {...tabAnimProps}>
          {/* Outer YStack owns the shadow — Android cannot combine elevation + overflow:hidden */}
          <YStack
            width={60}
            height={60}
            borderRadius={30}
            marginTop={-24}
            elevation={isFocused ? 8 : 4}
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: isFocused ? 0.18 : 0.08,
              shadowRadius: 6,
            }}
          >
            <HaloAiLogo ref={logoRef} size={60} loop={false} />
          </YStack>
          <SizableText
            size="$1"
            color={isFocused ? '$color9' : '$color8'}
            fontWeight={isFocused ? '700' : '500'}
            marginTop={-2}
          >
            {label}
          </SizableText>
        </YStack>
      </Theme>
    </Pressable>
  )
}
