import { useCallback, useState } from 'react'
import { FlatList, KeyboardAvoidingView, Platform } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { XStack, YStack, SizableText, Paragraph, Heading, Spinner } from 'tamagui'
import { MessageCircle, UserPlus, UserCheck, Flag } from '@tamagui/lucide-icons'
import { useToastController } from '@tamagui/toast'
import type { Reply } from '@halo/shared'
import { LikeButton } from '../../src/components/community/LikeButton'
import { PostImageGallery } from '../../src/components/community/PostImageGallery'
import { HeaderBar } from '../../src/components/ui/HeaderBar'
import {
  usePostDetailQuery,
  useRepliesQuery,
  useCreateReply,
  useTogglePostLike,
  useToggleReplyLike,
  useToggleFollow,
} from '../../src/api/community'
import { getRelativeTime } from '../../src/lib/community-utils'
import { AnimatedScreen, Button, Input, UserAvatar } from '../../src/components/ui'

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const toastCtrl = useToastController()
  const [replyText, setReplyText] = useState('')

  const postQuery = usePostDetailQuery(id ?? null)
  const repliesQuery = useRepliesQuery(id ?? '')
  const createReply = useCreateReply(id ?? '')
  const togglePostLike = useTogglePostLike()
  const toggleReplyLike = useToggleReplyLike(id ?? '')
  const toggleFollow = useToggleFollow()

  const post = postQuery.data
  const replies: Reply[] = repliesQuery.data?.pages.flatMap((page) => page.items) ?? []

  const handleSendReply = useCallback(() => {
    const trimmed = replyText.trim()
    if (!trimmed) return

    createReply.mutate(trimmed, {
      onSuccess: () => {
        setReplyText('')
        toastCtrl.show('Reply posted')
      },
      onError: (err) => {
        toastCtrl.show(err.message ?? 'Could not post reply')
      },
    })
  }, [replyText, createReply, toastCtrl])

  const renderReply = useCallback(
    ({ item }: { item: Reply }) => (
      <YStack
        backgroundColor="$color1"
        borderRadius="$3"
        padding="$3"
        gap="$2"
        marginHorizontal="$4"
        marginBottom="$2"
      >
        <XStack alignItems="center" gap="$2">
          <UserAvatar name={item.author.displayName} size="$2" />
          <SizableText size="$2" fontWeight="600" color="$color">
            {item.author.displayName}
          </SizableText>
          <SizableText size="$1" color="$color6">
            · {getRelativeTime(item.createdAt)}
          </SizableText>
        </XStack>

        <Paragraph size="$3" color="$color">
          {item.body}
        </Paragraph>

        <LikeButton
          liked={item.isLikedByMe}
          count={item.likeCount}
          size={16}
          label="reply"
          onPress={() => toggleReplyLike.mutate(item.id)}
        />
      </YStack>
    ),
    [toggleReplyLike],
  )

  const renderHeader = useCallback(() => {
    if (!post) return null

    return (
      <YStack gap="$4" paddingHorizontal="$4" paddingBottom="$4">
        {/* Author */}
        <XStack alignItems="center" gap="$3">
          <UserAvatar name={post.author.displayName} size="$4" />
          <YStack flex={1}>
            <SizableText size="$4" fontWeight="600" color="$color">
              {post.author.displayName}
            </SizableText>
            <XStack gap="$1.5" alignItems="center">
              {post.author.caregiverRelationship && (
                <SizableText size="$2" color="$accent9">
                  {post.author.caregiverRelationship}
                </SizableText>
              )}
              <SizableText size="$2" color="$color6">
                · {post.circleName}
              </SizableText>
              <SizableText size="$2" color="$color6">
                · {getRelativeTime(post.createdAt)}
              </SizableText>
            </XStack>
          </YStack>
          <XStack
            onPress={() => toggleFollow.mutate(post.author.id)}
            pressStyle={{ opacity: 0.7 }}
            padding="$2"
          >
            {post.isFollowingAuthor ? (
              <UserCheck size={20} color="$accent9" />
            ) : (
              <UserPlus size={20} color="$color6" />
            )}
          </XStack>
        </XStack>

        {/* Title & body */}
        <YStack gap="$2">
          <Heading size="$6">{post.title}</Heading>
          <Paragraph size="$4" color="$color">
            {post.body}
          </Paragraph>
        </YStack>

        {/* Images */}
        <PostImageGallery
          images={post.imageUrls.map((url) => ({ url }))}
          thumbnailHeight={200}
          thumbnailRadius="$4"
          multiImageLayout="stack"
        />

        {/* Actions */}
        <XStack
          alignItems="center"
          gap="$5"
          paddingVertical="$2"
          borderTopWidth={1}
          borderTopColor="$color4"
        >
          <LikeButton
            liked={post.isLikedByMe}
            count={post.likeCount}
            size={22}
            onPress={() => togglePostLike.mutate(post.id)}
          />

          <XStack alignItems="center" gap="$2">
            <MessageCircle size={22} color="$color6" />
            <SizableText size="$3" color="$color6">
              {post.replyCount}
            </SizableText>
          </XStack>
        </XStack>

        {/* Replies header */}
        <SizableText size="$3" fontWeight="600" color="$color6">
          Replies
        </SizableText>
      </YStack>
    )
  }, [post, togglePostLike, toggleFollow])

  if (postQuery.isLoading) {
    return (
      <AnimatedScreen>
        <YStack flex={1} alignItems="center" justifyContent="center">
          <Spinner size="large" color="$accent9" />
        </YStack>
      </AnimatedScreen>
    )
  }

  if (!post) {
    return (
      <AnimatedScreen>
        <YStack flex={1} alignItems="center" justifyContent="center" gap="$3">
          <SizableText size="$5" color="$color6">
            Post not found
          </SizableText>
          <Button label="Go back" onPress={() => router.back()} variant="secondary" />
        </YStack>
      </AnimatedScreen>
    )
  }

  return (
    <AnimatedScreen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <YStack flex={1} backgroundColor="$background">
          <HeaderBar showBack />

          {/* Post + replies list */}
          <FlatList
            data={replies}
            keyExtractor={(item) => item.id}
            renderItem={renderReply}
            ListHeaderComponent={renderHeader}
            onEndReached={() => {
              if (repliesQuery.hasNextPage) repliesQuery.fetchNextPage()
            }}
            onEndReachedThreshold={0.5}
            contentContainerStyle={{ paddingTop: 16, paddingBottom: 80 }}
          />

          {/* Reply input */}
          <XStack
            paddingHorizontal="$4"
            paddingVertical="$3"
            gap="$2"
            alignItems="center"
            borderTopWidth={1}
            borderTopColor="$color4"
            backgroundColor="$background"
          >
            <Input
              flex={1}
              placeholder="Write a reply..."
              value={replyText}
              onChangeText={setReplyText}
              maxLength={2000}
            />
            <Button
              label="Send"
              onPress={handleSendReply}
              disabled={!replyText.trim() || createReply.isPending}
              loading={createReply.isPending}
              variant="primary"
            />
          </XStack>
        </YStack>
      </KeyboardAvoidingView>
    </AnimatedScreen>
  )
}
