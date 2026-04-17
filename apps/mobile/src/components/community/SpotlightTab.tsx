import { useCallback } from 'react'
import { ScrollView, RefreshControl } from 'react-native'
import { YStack, XStack, Heading } from 'tamagui'
import { Star, TrendingUp } from '@tamagui/lucide-icons'
import { useSpotlightQuery, useTogglePostLike } from '../../api/community'
import { PostCard } from './PostCard'
import { EmptyState } from '../ui'

interface SpotlightTabProps {
  onPostPress: (postId: string) => void
}

export function SpotlightTab({ onPostPress }: SpotlightTabProps) {
  const spotlightQuery = useSpotlightQuery()
  const toggleLike = useTogglePostLike()

  const featured = spotlightQuery.data?.featured ?? []
  const trending = spotlightQuery.data?.trending ?? []

  const handleLike = useCallback(
    (postId: string) => {
      toggleLike.mutate(postId)
    },
    [toggleLike],
  )

  if (spotlightQuery.isLoading) {
    return <EmptyState icon={Star} title="Loading spotlight" isLoading />
  }

  if (!featured.length && !trending.length) {
    return (
      <EmptyState
        icon={Star}
        title="No spotlight posts yet"
        subtitle="Popular posts will appear here"
      />
    )
  }

  return (
    <ScrollView
      refreshControl={
        <RefreshControl
          refreshing={spotlightQuery.isRefetching}
          onRefresh={() => spotlightQuery.refetch()}
        />
      }
      contentContainerStyle={{ paddingBottom: 100 }}
    >
      {/* Featured section */}
      {featured.length > 0 && (
        <YStack gap="$3" paddingTop="$3">
          <XStack alignItems="center" gap="$2" paddingHorizontal="$4">
            <Star size={18} color="$accent9" />
            <Heading size="$4" color="$color">
              Featured
            </Heading>
          </XStack>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <XStack gap="$3" paddingHorizontal="$4">
              {featured.map((post) => (
                <YStack key={post.id} width={300}>
                  <PostCard
                    post={post}
                    onPress={() => onPostPress(post.id)}
                    onLike={() => handleLike(post.id)}
                  />
                </YStack>
              ))}
            </XStack>
          </ScrollView>
        </YStack>
      )}

      {/* Trending section */}
      {trending.length > 0 && (
        <YStack gap="$3" paddingTop="$4">
          <XStack alignItems="center" gap="$2" paddingHorizontal="$4">
            <TrendingUp size={18} color="$accent9" />
            <Heading size="$4" color="$color">
              Trending This Week
            </Heading>
          </XStack>
          {trending.map((post) => (
            <YStack key={post.id} paddingHorizontal="$4">
              <PostCard
                post={post}
                onPress={() => onPostPress(post.id)}
                onLike={() => handleLike(post.id)}
              />
            </YStack>
          ))}
        </YStack>
      )}
    </ScrollView>
  )
}
