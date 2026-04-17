import { useCallback } from 'react'
import { FlatList, RefreshControl } from 'react-native'
import { YStack } from 'tamagui'
import { Users } from '@tamagui/lucide-icons'
import type { PostListItem } from '@halo/shared'
import { useFollowingFeedQuery, useTogglePostLike } from '../../api/community'
import { PostCard } from './PostCard'
import { EmptyState } from '../ui'

interface FollowingTabProps {
  onPostPress: (postId: string) => void
}

export function FollowingTab({ onPostPress }: FollowingTabProps) {
  const feedQuery = useFollowingFeedQuery()
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
          icon={Users}
          title="No posts from people you follow"
          subtitle="Follow caregivers to see their posts here"
          isLoading={feedQuery.isLoading}
        />
      }
      contentContainerStyle={{ paddingTop: 8, paddingBottom: 100 }}
    />
  )
}
