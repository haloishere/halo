import { useCallback, useState } from 'react'
import { FlatList, RefreshControl } from 'react-native'
import { YStack } from 'tamagui'
import { MessageSquare } from '@tamagui/lucide-icons'
import { COMMUNITY_CIRCLES, type CommunityCircle, type PostListItem } from '@halo/shared'
import { useExploreFeedQuery, useTogglePostLike } from '../../api/community'
import { getCircleLabel } from '../../lib/community-utils'
import { PostCard } from './PostCard'
import { EmptyState, FilterChips } from '../ui'

interface ExploreTabProps {
  onPostPress: (postId: string) => void
}

export function ExploreTab({ onPostPress }: ExploreTabProps) {
  const [selectedCircle, setSelectedCircle] = useState<CommunityCircle | undefined>()

  const feedQuery = useExploreFeedQuery(selectedCircle)
  const toggleLike = useTogglePostLike()

  const posts: PostListItem[] = feedQuery.data?.pages.flatMap((page) => page.items) ?? []

  const handleLike = useCallback(
    (postId: string) => {
      toggleLike.mutate(postId)
    },
    [toggleLike],
  )

  const renderItem = useCallback(
    ({ item }: { item: PostListItem }) => (
      <YStack paddingHorizontal="$4" paddingBottom="$3">
        <PostCard
          post={item}
          onPress={() => onPostPress(item.id)}
          onLike={() => handleLike(item.id)}
        />
      </YStack>
    ),
    [onPostPress, handleLike],
  )

  return (
    <YStack flex={1}>
      <FilterChips
        items={COMMUNITY_CIRCLES}
        selected={selectedCircle}
        onSelect={setSelectedCircle}
        getLabel={getCircleLabel}
      />
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        onEndReached={() => {
          if (feedQuery.hasNextPage) feedQuery.fetchNextPage()
        }}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={feedQuery.isRefetching}
            onRefresh={() => feedQuery.refetch()}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon={MessageSquare}
            title="No posts yet"
            subtitle="Be the first to share something"
            isLoading={feedQuery.isLoading}
          />
        }
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 100 }}
      />
    </YStack>
  )
}
