import { XStack, SizableText } from 'tamagui'
import type { ContentCategory } from '@halo/shared'
import { getCategoryLabel } from '../../lib/content-utils'

interface CategoryBadgeProps {
  category: ContentCategory
}

export function CategoryBadge({ category }: CategoryBadgeProps) {
  return (
    <XStack
      backgroundColor="$accent3"
      paddingHorizontal="$1.5"
      paddingVertical="$0.5"
      borderRadius="$2"
      testID="category-badge"
    >
      <SizableText size="$1" color="$accent11" fontWeight="600">
        {getCategoryLabel(category)}
      </SizableText>
    </XStack>
  )
}
