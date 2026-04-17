import { type ReactNode, useCallback, useRef, useState } from 'react'
import { AnimatePresence, styled, Tabs, YStack } from 'tamagui'
import { UnderlineTabBar } from './UnderlineTabBar'

const AnimatedContentWrapper = styled(YStack, {
  flex: 1,
  x: 0,
  opacity: 1,
  transition: '100ms',

  variants: {
    direction: {
      ':number': (direction) => ({
        enterStyle: {
          x: direction > 0 ? -25 : 25,
          opacity: 0,
        },
        exitStyle: {
          zIndex: 0,
          x: direction < 0 ? -25 : 25,
          opacity: 0,
        },
      }),
    },
  } as const,
})

interface AnimatedTabsProps<T extends string> {
  tabs: readonly T[]
  labels: Record<T, string>
  defaultTab: T
  renderTab: (tab: T) => ReactNode
}

export function AnimatedTabs<T extends string>({
  tabs,
  labels,
  defaultTab,
  renderTab,
}: AnimatedTabsProps<T>) {
  const [activeTab, setActiveTab] = useState<T>(defaultTab)
  const prevTabRef = useRef<T>(defaultTab)

  const direction = (() => {
    const prevIndex = tabs.indexOf(prevTabRef.current)
    const currentIndex = tabs.indexOf(activeTab)
    if (prevIndex === currentIndex) return 0
    return currentIndex > prevIndex ? -1 : 1
  })()

  const handleTabChange = useCallback((value: string) => {
    setActiveTab((prev) => {
      prevTabRef.current = prev
      return value as T
    })
  }, [])

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} orientation="horizontal" flex={1}>
      <YStack flex={1} backgroundColor="$background">
        <UnderlineTabBar tabs={tabs} labels={labels} activeTab={activeTab} />

        <YStack flex={1} position="relative">
          <AnimatePresence custom={{ direction }} initial={false}>
            <AnimatedContentWrapper
              key={activeTab}
              // @ts-expect-error — Tamagui v2 RC ':number' variant type inference
              direction={direction}
              position="absolute"
              top={0}
              left={0}
              right={0}
              bottom={0}
            >
              <Tabs.Content value={activeTab} forceMount flex={1}>
                {renderTab(activeTab)}
              </Tabs.Content>
            </AnimatedContentWrapper>
          </AnimatePresence>
        </YStack>
      </YStack>
    </Tabs>
  )
}
