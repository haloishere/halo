import type { ReactNode } from 'react'
import { styled, YStack } from 'tamagui'

// TODO(tamagui-v2-stable): Animation spread bypasses Tamagui v2 RC type gap on `animation` prop in styled()
const enterAnimProps = {
  animation: 'quick',
  enterStyle: { opacity: 0, y: 6 },
} as Record<string, unknown>

const AnimatedFrame = styled(YStack, {
  flex: 1,
  opacity: 1,
  y: 0,
  ...enterAnimProps,
})

export interface AnimatedScreenProps {
  children: ReactNode
}

export function AnimatedScreen({ children }: AnimatedScreenProps) {
  return <AnimatedFrame>{children}</AnimatedFrame>
}
