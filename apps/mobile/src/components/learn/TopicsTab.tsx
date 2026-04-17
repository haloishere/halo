import { useCallback, useMemo, useState } from 'react'
import { FlatList, RefreshControl, type ViewStyle } from 'react-native'
import { Separator, SizableText, XStack, YStack } from 'tamagui'
import { ChevronLeft, ChevronRight, BookOpen } from '@tamagui/lucide-icons'
import { CONTENT_CATEGORIES, type ContentCategory, type ContentListItem } from '@halo/shared'
import { getCategoryLabel } from '../../lib/content-utils'
import { EmptyState } from '../ui'
import { renderArticleItem } from './renderArticleItem'
import { useContentQuery } from '../../api/content'

interface TopicsTabProps {
  onArticlePress: (slug: string) => void
  onBookmarkToggle: (id: string) => void
}

const articleListStyle: ViewStyle = { gap: 12, paddingBottom: 24 }
const categoryListStyle: ViewStyle = { paddingBottom: 24 }

function CategoryRow({ category, onPress }: { category: ContentCategory; onPress: () => void }) {
  return (
    <XStack
      paddingVertical="$4"
      paddingHorizontal="$2"
      justifyContent="space-between"
      alignItems="center"
      pressStyle={{ opacity: 0.7, backgroundColor: '$color2' }}
      borderRadius="$3"
      onPress={onPress}
      accessible
      accessibilityRole="button"
      accessibilityLabel={getCategoryLabel(category)}
      accessibilityHint="Shows articles in this category"
      testID={`topic-row-${category}`}
    >
      <SizableText size="$5" color="$color" fontWeight="500">
        {getCategoryLabel(category)}
      </SizableText>
      <ChevronRight size={20} color="$color8" />
    </XStack>
  )
}

export function TopicsTab({ onArticlePress, onBookmarkToggle }: TopicsTabProps) {
  const [selectedCategory, setSelectedCategory] = useState<ContentCategory | undefined>(undefined)

  const filteredQuery = useContentQuery({
    category: selectedCategory,
  })

  const filteredItems: ContentListItem[] =
    filteredQuery.data?.pages.flatMap((page) => page.items) ?? []

  const handleBack = useCallback(() => {
    setSelectedCategory(undefined)
  }, [])

  const renderItem = useMemo(
    () => renderArticleItem({ onArticlePress, onBookmarkToggle }),
    [onArticlePress, onBookmarkToggle],
  )

  if (selectedCategory) {
    return (
      <YStack flex={1} paddingHorizontal="$6">
        <XStack
          alignItems="center"
          gap="$2"
          paddingVertical="$3"
          pressStyle={{ opacity: 0.7 }}
          onPress={handleBack}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Back to all topics"
        >
          <ChevronLeft size={20} color="$accent9" />
          <SizableText size="$5" color="$accent9" fontWeight="600">
            {getCategoryLabel(selectedCategory)}
          </SizableText>
        </XStack>

        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={articleListStyle}
          refreshControl={
            <RefreshControl
              refreshing={filteredQuery.isRefetching}
              onRefresh={() => filteredQuery.refetch()}
            />
          }
          onEndReached={() => filteredQuery.hasNextPage && filteredQuery.fetchNextPage()}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            <EmptyState
              icon={BookOpen}
              title="No articles in this category"
              isLoading={filteredQuery.isLoading}
            />
          }
        />
      </YStack>
    )
  }

  return (
    <YStack flex={1} paddingHorizontal="$6" paddingTop="$4">
      <FlatList
        data={[...CONTENT_CATEGORIES]}
        keyExtractor={(cat) => cat}
        renderItem={({ item }) => (
          <CategoryRow category={item} onPress={() => setSelectedCategory(item)} />
        )}
        ItemSeparatorComponent={() => <Separator />}
        contentContainerStyle={categoryListStyle}
      />
    </YStack>
  )
}
