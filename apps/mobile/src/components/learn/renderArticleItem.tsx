import type { ContentCategory, ContentListItem } from '@halo/shared'
import { ArticleCard } from './ArticleCard'

interface ArticleItemCallbacks {
  onArticlePress: (slug: string) => void
  onBookmarkToggle: (id: string) => void
}

/**
 * Factory for FlatList renderItem that maps ContentListItem → ArticleCard.
 * Avoids repeating the 10-prop spread across every list in the learn module.
 */
export function renderArticleItem(
  { onArticlePress, onBookmarkToggle }: ArticleItemCallbacks,
  layout?: 'vertical' | 'horizontal',
) {
  return ({ item }: { item: ContentListItem }) => (
    <ArticleCard
      layout={layout}
      title={item.title}
      snippet={item.snippet}
      category={item.category as ContentCategory}
      videoUrl={item.videoUrl}
      thumbnailUrl={item.thumbnailUrl}
      isBookmarked={item.isBookmarked}
      progressPercent={item.progressPercent}
      onPress={() => onArticlePress(item.slug)}
      onBookmarkToggle={() => onBookmarkToggle(item.id)}
    />
  )
}
