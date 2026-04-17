import type { GestureResponderEvent } from 'react-native'
import { XStack, SizableText, Theme } from 'tamagui'
import { Heart } from '@tamagui/lucide-icons'

interface LikeButtonProps {
  liked: boolean
  count: number
  size?: number
  /** Context for screen readers, e.g. "post" or "reply" */
  label?: string
  onPress: () => void
  /** Prevent parent press handler from firing (e.g., inside a pressable card) */
  stopPropagation?: boolean
}

export function LikeButton({
  liked,
  count,
  size = 18,
  label = 'post',
  onPress,
  stopPropagation,
}: LikeButtonProps) {
  const content = (
    <XStack
      alignItems="center"
      gap="$1.5"
      minHeight={44}
      minWidth={44}
      onPress={(e: GestureResponderEvent) => {
        if (stopPropagation) e.stopPropagation()
        onPress()
      }}
      pressStyle={{ opacity: 0.7 }}
      accessible
      accessibilityRole="button"
      accessibilityLabel={liked ? `Unlike ${label}` : `Like ${label}`}
    >
      <Heart
        size={size}
        color={liked ? '$color9' : '$color6'}
        fill={liked ? 'currentColor' : 'none'}
      />
      <SizableText size={size <= 16 ? '$1' : '$2'} color={liked ? '$color9' : '$color6'}>
        {count}
      </SizableText>
    </XStack>
  )

  return liked ? <Theme name="error">{content}</Theme> : content
}
