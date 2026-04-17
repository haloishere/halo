import { Card, XStack, SizableText, Progress, Image } from 'tamagui'
import { Play } from '@tamagui/lucide-icons'
import type { ContentCategory } from '@halo/shared'
import { getCategoryLabel } from '../../lib/content-utils'
import { CategoryBadge } from './CategoryBadge'
import { BookmarkButton } from './BookmarkButton'

interface ArticleCardProps {
  title: string
  snippet?: string
  category: ContentCategory
  videoUrl?: string | null
  thumbnailUrl?: string | null
  isBookmarked: boolean
  progressPercent?: number | null
  onPress: () => void
  onBookmarkToggle: () => void
  /** "vertical" = full-width list card, "horizontal" = compact scroll card */
  layout?: 'vertical' | 'horizontal'
}

export function ArticleCard({
  title,
  snippet,
  category,
  videoUrl,
  thumbnailUrl,
  isBookmarked,
  progressPercent,
  onPress,
  onBookmarkToggle,
  layout = 'vertical',
}: ArticleCardProps) {
  const isHorizontal = layout === 'horizontal'

  return (
    <Card
      size={isHorizontal ? '$3' : '$4'}
      overflow="hidden"
      borderWidth={1}
      borderColor="$color4"
      {...(isHorizontal && {
        width: 200,
        height: 200,
      })}
      pressStyle={{ opacity: 0.85, scale: isHorizontal ? 0.98 : 0.99 }}
      onPress={onPress}
      testID={isHorizontal ? 'horizontal-article-card' : 'article-card'}
      accessible
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${getCategoryLabel(category)}`}
      accessibilityHint="Opens article"
    >
      <Progress
        value={progressPercent ?? 0}
        size="$1"
        backgroundColor="$color4"
        borderRadius={0}
        testID="article-progress"
      >
        <Progress.Indicator backgroundColor="$accent9" borderRadius={0} />
      </Progress>

      {thumbnailUrl && (
        <XStack position="relative" testID="article-thumbnail">
          <Image
            src={thumbnailUrl}
            width="100%"
            height={isHorizontal ? 80 : 120}
            objectFit="cover"
            alt={`Thumbnail for ${title}`}
            accessible
            accessibilityLabel={`Thumbnail for ${title}`}
          />
          <XStack position="absolute" top="$2" left="$2" gap="$1.5" alignItems="center">
            {videoUrl && (
              <XStack backgroundColor="$accent3" borderRadius="$2" padding="$1.5">
                <Play size={isHorizontal ? 16 : 18} color="$accent9" fill="$accent9" />
              </XStack>
            )}
          </XStack>
        </XStack>
      )}

      <XStack height="$2" />

      <SizableText
        size={isHorizontal ? '$4' : '$5'}
        fontWeight="600"
        color="$color"
        numberOfLines={isHorizontal ? 3 : 2}
        paddingHorizontal="$3"
      >
        {title}
      </SizableText>

      {!isHorizontal && snippet && (
        <SizableText size="$3" color="$color8" numberOfLines={3} paddingHorizontal="$3">
          {snippet}
        </SizableText>
      )}

      <Card.Footer paddingHorizontal="$3" paddingBottom="$3">
        <XStack justifyContent="space-between" alignItems="center" flex={1}>
          <CategoryBadge category={category} />
          <BookmarkButton
            isBookmarked={isBookmarked}
            onToggle={onBookmarkToggle}
            size={isHorizontal ? 16 : 18}
          />
        </XStack>
      </Card.Footer>
    </Card>
  )
}
