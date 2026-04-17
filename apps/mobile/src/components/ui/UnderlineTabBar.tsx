import { SizableText, Tabs } from 'tamagui'

interface UnderlineTabBarProps<T extends string> {
  tabs: readonly T[]
  labels: Record<T, string>
  activeTab: T
}

/**
 * Reusable tab bar with active underline indicator.
 * Must be rendered inside a <Tabs> parent.
 */
export function UnderlineTabBar<T extends string>({
  tabs,
  labels,
  activeTab,
}: UnderlineTabBarProps<T>) {
  return (
    <Tabs.List
      paddingHorizontal="$6"
      paddingBottom="$1.5"
      gap="$4"
      borderBottomWidth={1}
      borderBottomColor="$color4"
      backgroundColor="transparent"
    >
      {tabs.map((tab) => {
        const isActive = tab === activeTab
        return (
          <Tabs.Tab
            key={tab}
            value={tab}
            unstyled
            paddingVertical="$2"
            paddingHorizontal="$1"
            borderBottomWidth={2}
            borderBottomColor={isActive ? '$accent9' : 'transparent'}
            pressStyle={{ opacity: 0.7 }}
            accessibilityLabel={labels[tab]}
          >
            <SizableText
              size="$4"
              fontWeight={isActive ? '700' : '500'}
              color={isActive ? '$accent9' : '$color8'}
            >
              {labels[tab]}
            </SizableText>
          </Tabs.Tab>
        )
      })}
    </Tabs.List>
  )
}
