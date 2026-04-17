import { useCallback, useMemo } from 'react'
import { Image, ScrollView, type TextStyle } from 'react-native'
import { useLocalSearchParams, Stack, router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { YStack, XStack, SizableText, Spinner, useTheme } from 'tamagui'
import { ChevronLeft } from '@tamagui/lucide-icons'
import { useToastController } from '@tamagui/toast'
import Markdown from 'react-native-markdown-display'
import type { ContentCategory } from '@halo/shared'
import { useContentBySlugQuery, useToggleBookmark } from '../../src/api/content'
import { useReadingProgress } from '../../src/hooks/useReadingProgress'
import { formatReadTime } from '../../src/lib/content-utils'
import { VideoEmbed } from '../../src/components/learn/VideoEmbed'
import { CategoryBadge } from '../../src/components/learn/CategoryBadge'
import { BookmarkButton } from '../../src/components/learn/BookmarkButton'

function ArticleHeader({
  title,
  isBookmarked,
  onBack,
  onBookmarkToggle,
}: {
  title: string
  isBookmarked: boolean
  onBack: () => void
  onBookmarkToggle: () => void
}) {
  const insets = useSafeAreaInsets()

  return (
    <YStack
      backgroundColor="$background"
      paddingTop={insets.top}
      borderBottomWidth={1}
      borderBottomColor="$color4"
    >
      <XStack height={48} alignItems="center" paddingHorizontal="$4" gap="$3">
        <XStack
          padding="$1"
          pressStyle={{ opacity: 0.7 }}
          onPress={onBack}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ChevronLeft size={24} color="$color" />
        </XStack>

        <SizableText size="$6" color="$color" fontWeight="600" numberOfLines={1} flex={1}>
          {title}
        </SizableText>

        <BookmarkButton isBookmarked={isBookmarked} onToggle={onBookmarkToggle} size={22} />
      </XStack>
    </YStack>
  )
}

export default function ArticleDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const toastCtrl = useToastController()
  const theme = useTheme()
  const { data: article, isLoading, isError } = useContentBySlugQuery(slug ?? null)

  const markdownStyles = useMemo(() => {
    const text: TextStyle = { color: theme.color?.val }
    return {
      body: { color: theme.color?.val } as TextStyle,
      heading1: { ...text, fontSize: 24, fontWeight: '700' as const, marginVertical: 12 },
      heading2: { ...text, fontSize: 20, fontWeight: '600' as const, marginVertical: 10 },
      heading3: { ...text, fontSize: 18, fontWeight: '600' as const, marginVertical: 8 },
      paragraph: { ...text, fontSize: 16, lineHeight: 24, marginVertical: 6 },
      listItem: { ...text, fontSize: 16, lineHeight: 24 },
      listUnorderedItemIcon: { color: theme.color?.val } as TextStyle,
      strong: { ...text, fontWeight: '700' as const },
      em: { ...text, fontStyle: 'italic' as const },
      link: { color: theme.accent9?.val } as TextStyle,
      blockquote: {
        backgroundColor: theme.color2?.val,
        borderLeftColor: theme.accent9?.val,
        borderLeftWidth: 3,
        paddingHorizontal: 12,
        paddingVertical: 4,
      } as TextStyle,
      code_inline: {
        ...text,
        backgroundColor: theme.color2?.val,
        paddingHorizontal: 4,
        borderRadius: 4,
        fontSize: 14,
      } as TextStyle,
      code_block: {
        ...text,
        backgroundColor: theme.color2?.val,
        padding: 12,
        borderRadius: 8,
        fontSize: 14,
      } as TextStyle,
    }
  }, [theme])
  const toggleBookmark = useToggleBookmark()
  const { onScroll } = useReadingProgress(article?.id ?? '', article?.progressPercent ?? 0)

  const handleBookmarkToggle = useCallback(() => {
    if (!article) return
    toggleBookmark.mutate(article.id, {
      onSuccess: (result) => {
        toastCtrl.show(result?.bookmarked ? 'Bookmarked' : 'Bookmark removed')
      },
      onError: () => {
        toastCtrl.show("Couldn't update bookmark. Try again.")
      },
    })
  }, [article, toggleBookmark, toastCtrl])

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor="$background">
          <Spinner size="large" color="$accent9" />
        </YStack>
      </>
    )
  }

  if (isError || !article) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor="$background">
          <SizableText size="$5" color="$color6">
            Article not found
          </SizableText>
        </YStack>
      </>
    )
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ArticleHeader
        title={article.title}
        isBookmarked={article.isBookmarked}
        onBack={() => router.back()}
        onBookmarkToggle={handleBookmarkToggle}
      />
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background?.val }}
        contentContainerStyle={{ padding: 24, paddingBottom: 48 }}
        onScroll={onScroll}
        scrollEventThrottle={100}
      >
        {/* Hero image */}
        {article.thumbnailUrl && (
          <Image
            source={{ uri: article.thumbnailUrl }}
            style={{ width: '100%', height: 200, borderRadius: 12, marginBottom: 16 }}
            resizeMode="cover"
            accessibilityLabel={`Hero image for ${article.title}`}
          />
        )}

        <YStack gap="$2" marginBottom="$4">
          {/* Category badge + reading time */}
          <XStack gap="$3" alignItems="center">
            <CategoryBadge category={article.category as ContentCategory} />
            <SizableText size="$2" color="$color6">
              {formatReadTime(article.body)}
            </SizableText>
          </XStack>

          {/* Title */}
          <SizableText size="$8" fontWeight="700" color="$color">
            {article.title}
          </SizableText>
        </YStack>

        {/* Video embed */}
        {article.videoUrl && <VideoEmbed url={article.videoUrl} />}

        {/* Markdown body */}
        <Markdown style={markdownStyles}>{article.body}</Markdown>
      </ScrollView>
    </>
  )
}
