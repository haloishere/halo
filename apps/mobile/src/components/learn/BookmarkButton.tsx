import { XStack } from 'tamagui'
import { Bookmark, BookmarkCheck } from '@tamagui/lucide-icons'

interface BookmarkButtonProps {
  isBookmarked: boolean
  onToggle: () => void
  size?: number
}

export function BookmarkButton({ isBookmarked, onToggle, size = 18 }: BookmarkButtonProps) {
  const Icon = isBookmarked ? BookmarkCheck : Bookmark

  return (
    <XStack
      padding="$2"
      backgroundColor={isBookmarked ? '$accent3' : 'transparent'}
      borderRadius={100}
      pressStyle={{ opacity: 0.7 }}
      onPress={(e) => {
        e?.stopPropagation?.()
        onToggle()
      }}
      accessible
      accessibilityRole="button"
      accessibilityLabel={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}
      testID="bookmark-button"
    >
      <Icon size={size} color={isBookmarked ? '$accent9' : '$color8'} />
    </XStack>
  )
}
