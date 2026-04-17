import { Card, XStack, YStack, SizableText, Paragraph } from 'tamagui'
import { MessageCircle } from '@tamagui/lucide-icons'
import type { PostListItem } from '@halo/shared'
import { getRelativeTime } from '../../lib/community-utils'
import { UserAvatar } from '../ui'
import { LikeButton } from './LikeButton'
import { PostImageGallery } from './PostImageGallery'

interface PostCardProps {
  post: PostListItem
  onPress: () => void
  onLike: () => void
}

export function PostCard({ post, onPress, onLike }: PostCardProps) {
  return (
    <Card
      size="$4"
      borderWidth={1}
      borderColor="$color4"
      pressStyle={{ opacity: 0.85, scale: 0.99 }}
      onPress={onPress}
      accessible
      accessibilityRole="button"
      accessibilityLabel={`Post by ${post.author.displayName}: ${post.title}`}
    >
      <Card.Header padding="$4" gap="$2">
        <XStack alignItems="center" gap="$2">
          <UserAvatar name={post.author.displayName} size="$3" />
          <YStack flex={1}>
            <SizableText size="$2" fontWeight="600" color="$color">
              {post.author.displayName}
            </SizableText>
            <XStack gap="$1.5" alignItems="center">
              {post.author.caregiverRelationship && (
                <SizableText size="$1" color="$accent9">
                  {post.author.caregiverRelationship}
                </SizableText>
              )}
              <SizableText size="$1" color="$color6">
                · {getRelativeTime(post.createdAt)}
              </SizableText>
            </XStack>
          </YStack>
          <SizableText size="$1" color="$accent9" fontWeight="500">
            {post.circleName}
          </SizableText>
        </XStack>

        <SizableText size="$5" fontWeight="700" color="$color">
          {post.title}
        </SizableText>
        <Paragraph size="$3" color="$color8" numberOfLines={3}>
          {post.bodySnippet}
        </Paragraph>
      </Card.Header>

      <PostImageGallery
        images={post.imageUrls.map((url) => ({ url }))}
        thumbnailHeight={150}
        thumbnailRadius="$3"
        containerPaddingX="$4"
      />

      <Card.Footer padding="$4" paddingTop="$1">
        <XStack alignItems="center" gap="$4">
          <LikeButton
            liked={post.isLikedByMe}
            count={post.likeCount}
            onPress={onLike}
            stopPropagation
          />
          <XStack alignItems="center" gap="$1.5">
            <MessageCircle size={18} color="$color6" />
            <SizableText size="$2" color="$color6">
              {post.replyCount}
            </SizableText>
          </XStack>
        </XStack>
      </Card.Footer>
    </Card>
  )
}
