import { Pressable } from 'react-native'
import { XStack, YStack, SizableText } from 'tamagui'
import { Home, Fingerprint, CircleCheckBig, User } from '@tamagui/lucide-icons'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { CtaTabItem } from './CtaTabItem'

// TODO(tamagui-v2-stable): Animation spread bypasses Tamagui v2 RC type gap on `animation` prop
const tabAnimProps = { animation: 'quick' } as Record<string, unknown>

const CTA_ROUTE = 'ai-chat'

const TAB_ICONS = {
  index: Home,
  vault: Fingerprint,
  [CTA_ROUTE]: null,
  audit: CircleCheckBig,
  profile: User,
} as const

export function TabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  // Respect the `tabBarStyle` option that the CURRENTLY FOCUSED tab's
  // descriptor sets. React Navigation's default Tab Bar reads this to
  // hide itself when a nested-stack screen sets `{ display: 'none' }`,
  // but since this project uses a custom `tabBar={(props) => <TabBar/>}`
  // override the option is ignored unless we honor it here.
  //
  // Concrete use case: the Chat tab's nested `(tabs)/ai-chat/_layout.tsx`
  // Stack has a chat detail screen `[id]` and a history screen, both of
  // which should be fullscreen (no bottom tab bar). `(tabs)/_layout.tsx`
  // uses `getFocusedRouteNameFromRoute` to set `tabBarStyle: { display:
  // 'none' }` on those leaves — but the option only takes effect once
  // this custom TabBar reads it.
  const activeRoute = state.routes[state.index]
  const activeDescriptor = activeRoute ? descriptors[activeRoute.key] : undefined
  const focusedTabBarStyle = activeDescriptor?.options?.tabBarStyle as
    | { display?: 'none' | 'flex' }
    | undefined
  if (focusedTabBarStyle?.display === 'none') return null

  return (
    <XStack
      backgroundColor="$color2"
      borderTopWidth={1}
      borderTopColor="$color4"
      paddingBottom={insets.bottom}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key]!
        const label = (options.tabBarLabel ?? options.title ?? route.name) as string
        const isFocused = state.index === index
        const Icon = TAB_ICONS[route.name as keyof typeof TAB_ICONS]
        const isCta = route.name === CTA_ROUTE
        if (__DEV__ && !Icon && !isCta) console.warn(`TabBar: no icon for route "${route.name}"`)

        const handlePress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          })

          if (!event.defaultPrevented && !isFocused) {
            navigation.navigate(route.name, route.params)
          }
        }

        if (isCta) {
          return (
            <CtaTabItem key={route.key} label={label} isFocused={isFocused} onPress={handlePress} />
          )
        }

        const color = isFocused ? '$accent9' : '$accent8'

        return (
          <Pressable
            key={route.key}
            onPress={handlePress}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: isFocused }}
            style={{ flex: 1, alignItems: 'center', paddingVertical: 10 }}
          >
            <XStack
              testID="tab-indicator"
              position="absolute"
              top={0}
              left="$2"
              right="$2"
              height={3}
              backgroundColor="$accent9"
              borderRadius="$10"
              opacity={isFocused ? 1 : 0}
              {...tabAnimProps}
            />
            <YStack alignItems="center" gap="$1" scale={isFocused ? 1.1 : 1} {...tabAnimProps}>
              {Icon && <Icon size={24} color={color} strokeWidth={2} />}
              <SizableText size="$2" color={color}>
                {label}
              </SizableText>
            </YStack>
          </Pressable>
        )
      })}
    </XStack>
  )
}
