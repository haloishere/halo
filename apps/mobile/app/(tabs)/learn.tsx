import { useCallback } from 'react'
import { useRouter } from 'expo-router'
import { useToastController } from '@tamagui/toast'
import type { ContentListItem } from '@halo/shared'
import { AnimatedScreen, AnimatedTabs } from '../../src/components/ui'
import { ForYouTab } from '../../src/components/learn/ForYouTab'
import { TopicsTab } from '../../src/components/learn/TopicsTab'
import { BookmarksTab } from '../../src/components/learn/BookmarksTab'
import { LearningPathTab } from '../../src/components/learn/LearningPathTab'
import {
  LEARN_TABS,
  LEARN_TAB_LABELS,
  type LearnTabValue,
} from '../../src/components/learn/constants'
import { useBrowseContentQuery, useBookmarksQuery, useToggleBookmark } from '../../src/api/content'

export default function LearnScreen() {
  const router = useRouter()
  const toastCtrl = useToastController()

  // ─── Data fetching ──────────────────────────────────────────────────────────
  const browseQuery = useBrowseContentQuery()
  const bookmarksQuery = useBookmarksQuery()
  const toggleBookmark = useToggleBookmark()

  const browseItems: ContentListItem[] = browseQuery.data ?? []
  const bookmarkItems: ContentListItem[] =
    bookmarksQuery.data?.pages.flatMap((page) => page.items) ?? []

  const handleArticlePress = useCallback(
    (slug: string) => {
      router.push(`/learn/${slug}`)
    },
    [router],
  )

  const handleBookmarkToggle = useCallback(
    (id: string) => {
      toggleBookmark.mutate(id, {
        onSuccess: (result) => {
          toastCtrl.show(result?.bookmarked ? 'Bookmarked' : 'Bookmark removed')
        },
        onError: () => {
          toastCtrl.show("Couldn't update bookmark. Try again.")
        },
      })
    },
    [toggleBookmark, toastCtrl],
  )

  const renderTab = useCallback(
    (tab: LearnTabValue) => {
      switch (tab) {
        case 'for-you':
          return (
            <ForYouTab
              items={browseItems}
              isLoading={browseQuery.isLoading}
              isError={browseQuery.isError}
              isRefetching={browseQuery.isRefetching}
              onRefresh={() => browseQuery.refetch()}
              onArticlePress={handleArticlePress}
              onBookmarkToggle={handleBookmarkToggle}
            />
          )
        case 'topics':
          return (
            <TopicsTab
              onArticlePress={handleArticlePress}
              onBookmarkToggle={handleBookmarkToggle}
            />
          )
        case 'bookmarks':
          return (
            <BookmarksTab
              items={bookmarkItems}
              isLoading={bookmarksQuery.isLoading}
              isRefetching={bookmarksQuery.isRefetching}
              hasNextPage={bookmarksQuery.hasNextPage}
              onFetchNextPage={() => bookmarksQuery.fetchNextPage()}
              onRefresh={() => bookmarksQuery.refetch()}
              onArticlePress={handleArticlePress}
              onBookmarkToggle={handleBookmarkToggle}
            />
          )
        case 'learning-path':
          return <LearningPathTab />
      }
    },
    [
      browseItems,
      browseQuery.isLoading,
      browseQuery.isError,
      browseQuery.isRefetching,
      browseQuery.refetch,
      bookmarkItems,
      bookmarksQuery.isLoading,
      bookmarksQuery.isRefetching,
      bookmarksQuery.hasNextPage,
      bookmarksQuery.fetchNextPage,
      bookmarksQuery.refetch,
      handleArticlePress,
      handleBookmarkToggle,
    ],
  )

  return (
    <AnimatedScreen>
      <AnimatedTabs
        tabs={LEARN_TABS}
        labels={LEARN_TAB_LABELS}
        defaultTab="for-you"
        renderTab={renderTab}
      />
    </AnimatedScreen>
  )
}
