import { Easing, useWindowDimensions } from 'react-native'
import { Tabs, useRouter } from 'expo-router'
import type { RouteProp } from '@react-navigation/native'
import { getFocusedRouteNameFromRoute } from '@react-navigation/native'
import { useTheme } from 'tamagui'
import { TabBar } from '../../src/components/ui/TabBar'
import { HeaderBar } from '../../src/components/ui/HeaderBar'
import { BrandLogo } from '../../src/components/ui'
import { ChatHeaderMenu } from '../../src/components/chat/ChatHeaderMenu'

function ScenariosHeader() {
  const router = useRouter()
  return (
    <HeaderBar
      title="Scenarios"
      rightAction={
        <ChatHeaderMenu
          onNewChat={() => router.replace('/ai-chat')}
          onHistory={() => router.push('/ai-chat/history')}
        />
      }
    />
  )
}

/**
 * Hide the Tabs navigator chrome (top header + bottom tab bar) when
 * the ai-chat nested Stack is focused on any screen OTHER than its
 * `index` redirect. The chat detail screen (`[id]`) and the history
 * list (`history`) are intentionally fullscreen — they render their
 * own `<HeaderBar />` and should not inherit the tab chrome.
 *
 * Uses `getFocusedRouteNameFromRoute` to read the active leaf of the
 * nested stack from the Tabs parent. Declarative, lives in one place,
 * so leaf screens don't need `useLayoutEffect` + `getParent().setOptions`
 * hacks.
 */
function aiChatTabOptions({ route }: { route: RouteProp<Record<string, object | undefined>> }) {
  const focused = getFocusedRouteNameFromRoute(route) ?? 'index'
  const hideChrome = focused !== 'index'
  return {
    title: 'Scenarios',
    headerShown: !hideChrome,
    tabBarStyle: hideChrome ? ({ display: 'none' } as const) : undefined,
    header: hideChrome ? undefined : () => <ScenariosHeader />,
  }
}

export default function TabsLayout() {
  const theme = useTheme()
  const { width } = useWindowDimensions()
  const slideDistance = width * 0.15

  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: true,
        headerStatusBarHeight: 0,
        header: ({ options }) => <HeaderBar title={options.title} />,
        transitionSpec: {
          animation: 'timing',
          config: { duration: 100, easing: Easing.out(Easing.ease) },
        },
        sceneStyleInterpolator: ({ current }) => ({
          sceneStyle: {
            transform: [
              {
                translateX: current.progress.interpolate({
                  inputRange: [-1, 0, 1],
                  outputRange: [slideDistance, 0, -slideDistance],
                }),
              },
            ],
          },
        }),
        sceneStyle: { backgroundColor: theme.background?.val },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          header: () => <HeaderBar title={<BrandLogo size="$12" animated={false} />} />,
        }}
      />
      <Tabs.Screen name="vault" options={{ title: 'Portrait' }} />
      <Tabs.Screen name="ai-chat" options={aiChatTabOptions} />
      <Tabs.Screen name="audit" options={{ title: 'Promise' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  )
}
