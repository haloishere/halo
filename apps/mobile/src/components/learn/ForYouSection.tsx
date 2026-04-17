import { useMemo } from 'react'
import { FlatList, type ViewStyle } from 'react-native'
import { XStack, YStack, H5, SizableText } from 'tamagui'
import { ChevronRight } from '@tamagui/lucide-icons'
import type { ContentListItem } from '@halo/shared'
import { renderArticleItem } from './renderArticleItem'
import { MAX_SECTION_ITEMS } from './constants'

const horizontalListStyle: ViewStyle = { gap: 12, paddingHorizontal: 24 }
const horizontalFlatListStyle: ViewStyle = { marginHorizontal: -24 }

interface ForYouSectionProps {
  title: string
  items: readonly ContentListItem[]
  onArticlePress: (slug: string) => void
  onBookmarkToggle: (id: string) => void
  onSeeAll?: () => void
}

export function ForYouSection({
  title,
  items,
  onArticlePress,
  onBookmarkToggle,
  onSeeAll,
}: ForYouSectionProps) {
  const renderItem = useMemo(
    () => renderArticleItem({ onArticlePress, onBookmarkToggle }, 'horizontal'),
    [onArticlePress, onBookmarkToggle],
  )

  if (items.length === 0) return null

  return (
    <YStack gap="$3" testID={`section-${title.toLowerCase().replace(/\s+/gu, '-')}`}>
      <XStack justifyContent="space-between" alignItems="center" paddingHorizontal="$1">
        <H5 color="$color" accessible accessibilityRole="header">
          {title}
        </H5>
        {onSeeAll && (
          <XStack
            alignItems="center"
            gap="$1"
            pressStyle={{ opacity: 0.7 }}
            onPress={onSeeAll}
            accessible
            accessibilityRole="button"
            accessibilityLabel={`See all ${title} articles`}
          >
            <SizableText size="$3" color="$accent9" fontWeight="500">
              See All
            </SizableText>
            <ChevronRight size={16} color="$accent9" />
          </XStack>
        )}
      </XStack>

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        style={horizontalFlatListStyle}
        data={items.slice(0, MAX_SECTION_ITEMS)}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={horizontalListStyle}
        accessibilityLabel={`${title} articles`}
      />
    </YStack>
  )
}
