import { useMemo } from 'react'
import { FlatList, RefreshControl, type ViewStyle } from 'react-native'
import { Bookmark } from '@tamagui/lucide-icons'
import type { ContentListItem } from '@halo/shared'
import { EmptyState } from '../ui'
import { renderArticleItem } from './renderArticleItem'

interface BookmarksTabProps {
  items: ContentListItem[]
  isLoading: boolean
  isRefetching: boolean
  hasNextPage: boolean | undefined
  onFetchNextPage: () => void
  onRefresh: () => void
  onArticlePress: (slug: string) => void
  onBookmarkToggle: (id: string) => void
}

const listStyle: ViewStyle = { gap: 12, paddingTop: 8, paddingBottom: 24 }

export function BookmarksTab({
  items,
  isLoading,
  isRefetching,
  hasNextPage,
  onFetchNextPage,
  onRefresh,
  onArticlePress,
  onBookmarkToggle,
}: BookmarksTabProps) {
  const renderItem = useMemo(
    () => renderArticleItem({ onArticlePress, onBookmarkToggle }),
    [onArticlePress, onBookmarkToggle],
  )

  return (
    <FlatList
      style={{ flex: 1, paddingHorizontal: 24 }}
      data={items}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      contentContainerStyle={listStyle}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} />}
      onEndReached={() => hasNextPage && onFetchNextPage()}
      onEndReachedThreshold={0.5}
      ListEmptyComponent={
        <EmptyState
          icon={Bookmark}
          title="No bookmarked articles yet"
          subtitle="Bookmark articles to find them here"
          isLoading={isLoading}
        />
      }
    />
  )
}
