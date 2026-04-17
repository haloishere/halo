import { useCallback } from 'react'
import { useRouter } from 'expo-router'
import { Button, Theme } from 'tamagui'
import { Plus } from '@tamagui/lucide-icons'
import { AnimatedScreen, AnimatedTabs } from '../../src/components/ui'
import { ExploreTab } from '../../src/components/community/ExploreTab'
import { FollowingTab } from '../../src/components/community/FollowingTab'
import { SpotlightTab } from '../../src/components/community/SpotlightTab'
import {
  COMMUNITY_TABS,
  COMMUNITY_TAB_LABELS,
  type CommunityTabValue,
} from '../../src/components/community/constants'

export default function CommunityScreen() {
  const router = useRouter()

  const handlePostPress = useCallback(
    (postId: string) => {
      router.push(`/community/${postId}`)
    },
    [router],
  )

  const handleCreatePost = useCallback(() => {
    router.push('/community/create')
  }, [router])

  const renderTab = useCallback(
    (tab: CommunityTabValue) => {
      switch (tab) {
        case 'explore':
          return <ExploreTab onPostPress={handlePostPress} />
        case 'following':
          return <FollowingTab onPostPress={handlePostPress} />
        case 'spotlight':
          return <SpotlightTab onPostPress={handlePostPress} />
      }
    },
    [handlePostPress],
  )

  return (
    <AnimatedScreen>
      <AnimatedTabs
        tabs={COMMUNITY_TABS}
        labels={COMMUNITY_TAB_LABELS}
        defaultTab="explore"
        renderTab={renderTab}
      />
      <Theme name="accent">
        <Button
          position="absolute"
          bottom="$4"
          right="$4"
          size="$5"
          circular
          backgroundColor="$color8"
          onPress={handleCreatePost}
          accessibilityLabel="Create post"
        >
          <Plus size={24} color="$color1" />
        </Button>
      </Theme>
    </AnimatedScreen>
  )
}
