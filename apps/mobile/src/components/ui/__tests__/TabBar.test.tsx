import React, { forwardRef } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '../../../test/render'
import { TabBar } from '../TabBar'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import type { TabNavigationState, ParamListBase } from '@react-navigation/native'

vi.mock('lottie-react-native', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- vi.mock factory must use require
  const { View } = require('react-native')
  return {
    default: forwardRef((props: Record<string, unknown>, ref: React.Ref<unknown>) => {
      React.useImperativeHandle(ref, () => ({ play: vi.fn(), pause: vi.fn() }))
      return <View testID="lottie-cta" {...props} />
    }),
  }
})

vi.mock('@tamagui/lucide-icons', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- vi.mock factory must use require
  const { Text } = require('react-native')
  return {
    Home: (props: Record<string, unknown>) => <Text testID="icon-home" {...props} />,
    BookOpen: (props: Record<string, unknown>) => <Text testID="icon-book-open" {...props} />,
    MessageSquareHeart: (props: Record<string, unknown>) => (
      <Text testID="icon-message-square-heart" {...props} />
    ),
    User: (props: Record<string, unknown>) => <Text testID="icon-user" {...props} />,
  }
})

function makeTabBarProps(overrides: { activeIndex?: number } = {}): BottomTabBarProps {
  const { activeIndex = 0 } = overrides

  const routes = [
    { key: 'index-1', name: 'index', params: undefined },
    { key: 'learn-1', name: 'learn', params: undefined },
    { key: 'ai-chat-1', name: 'ai-chat', params: undefined },
    { key: 'community-1', name: 'community', params: undefined },
    { key: 'profile-1', name: 'profile', params: undefined },
  ]

  const titles: Record<string, string> = {
    index: 'Home',
    learn: 'Learn',
    'ai-chat': 'Assistant',
    community: 'Community',
    profile: 'Profile',
  }

  const state = {
    index: activeIndex,
    routes,
    key: 'tab-1',
    routeNames: ['index', 'learn', 'ai-chat', 'community', 'profile'],
    stale: false,
    type: 'tab',
    history: [{ type: 'route' as const, key: routes[activeIndex]!.key }],
  } as TabNavigationState<ParamListBase>

  const navigation = {
    emit: vi.fn(() => ({ defaultPrevented: false })),
    navigate: vi.fn(),
  } as unknown as BottomTabBarProps['navigation']

  const descriptors = Object.fromEntries(
    routes.map((route) => [
      route.key,
      {
        options: { title: titles[route.name] },
        navigation,
        render: () => null,
      },
    ]),
  ) as unknown as BottomTabBarProps['descriptors']

  const insets = { top: 0, right: 0, bottom: 0, left: 0 }

  return { state, descriptors, navigation, insets }
}

describe('TabBar — rendering', () => {
  it('renders all five tab labels', () => {
    const props = makeTabBarProps()
    const { getByText } = render(<TabBar {...props} />)
    expect(getByText('Home')).toBeTruthy()
    expect(getByText('Learn')).toBeTruthy()
    expect(getByText('Assistant')).toBeTruthy()
    expect(getByText('Community')).toBeTruthy()
    expect(getByText('Profile')).toBeTruthy()
  })

  it('renders icons for non-CTA tabs and Lottie animation for the CTA tab', () => {
    const props = makeTabBarProps()
    const { getByTestId, queryByTestId } = render(<TabBar {...props} />)
    expect(getByTestId('icon-home')).toBeTruthy()
    expect(getByTestId('icon-book-open')).toBeTruthy()
    expect(getByTestId('icon-message-square-heart')).toBeTruthy()
    expect(getByTestId('icon-user')).toBeTruthy()
    expect(getByTestId('lottie-cta')).toBeTruthy()
    expect(queryByTestId('icon-users')).toBeNull()
  })
})

describe('TabBar — active state', () => {
  it('marks the first tab as selected by default', () => {
    const props = makeTabBarProps({ activeIndex: 0 })
    const { getByLabelText } = render(<TabBar {...props} />)
    expect(getByLabelText('Home').props.accessibilityState.selected).toBe(true)
  })

  it('marks Assistant tab as selected when activeIndex is 2', () => {
    const props = makeTabBarProps({ activeIndex: 2 })
    const { getByLabelText } = render(<TabBar {...props} />)
    expect(getByLabelText('Assistant').props.accessibilityState.selected).toBe(true)
  })

  it('marks inactive tabs as not selected', () => {
    const props = makeTabBarProps({ activeIndex: 0 })
    const { getByLabelText } = render(<TabBar {...props} />)
    expect(getByLabelText('Learn').props.accessibilityState.selected).toBe(false)
    expect(getByLabelText('Assistant').props.accessibilityState.selected).toBe(false)
    expect(getByLabelText('Community').props.accessibilityState.selected).toBe(false)
    expect(getByLabelText('Profile').props.accessibilityState.selected).toBe(false)
  })
})

describe('TabBar — navigation', () => {
  it('emits tabPress and navigates on press', () => {
    const props = makeTabBarProps({ activeIndex: 0 })
    const { getByLabelText } = render(<TabBar {...props} />)
    fireEvent.press(getByLabelText('Learn'))
    expect(props.navigation.emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'tabPress', target: 'learn-1' }),
    )
    expect(props.navigation.navigate).toHaveBeenCalledWith('learn', undefined)
  })

  it('does not navigate if tabPress event is prevented', () => {
    const props = makeTabBarProps({ activeIndex: 0 })
    ;(props.navigation.emit as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      defaultPrevented: true,
    })
    const { getByLabelText } = render(<TabBar {...props} />)
    fireEvent.press(getByLabelText('Assistant'))
    expect(props.navigation.navigate).not.toHaveBeenCalled()
  })

  it('does not navigate when pressing the already-active tab', () => {
    const props = makeTabBarProps({ activeIndex: 0 })
    const { getByLabelText } = render(<TabBar {...props} />)
    fireEvent.press(getByLabelText('Home'))
    expect(props.navigation.navigate).not.toHaveBeenCalled()
  })
})

describe('TabBar — warnings', () => {
  it('warns in __DEV__ when a route has no matching icon', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const props = makeTabBarProps()
    const unknownRoute = { key: 'unknown-1', name: 'unknown', params: undefined }
    props.state.routes[0] = unknownRoute
    // Add a descriptor so the render doesn't crash on missing key
    ;(props.descriptors as Record<string, unknown>)['unknown-1'] = {
      options: { title: 'Unknown' },
      navigation: props.navigation,
      render: () => null,
    }
    render(<TabBar {...props} />)
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('no icon for route "unknown"'))
    warnSpy.mockRestore()
  })
})

describe('TabBar — accessibility', () => {
  it('each tab has accessibilityRole tab', () => {
    const props = makeTabBarProps()
    const { getByLabelText } = render(<TabBar {...props} />)
    expect(getByLabelText('Home').props.accessibilityRole).toBe('tab')
    expect(getByLabelText('Profile').props.accessibilityRole).toBe('tab')
  })

  it('every tab has an accessibilityLabel', () => {
    const props = makeTabBarProps()
    const { getByLabelText } = render(<TabBar {...props} />)
    expect(getByLabelText('Home')).toBeTruthy()
    expect(getByLabelText('Learn')).toBeTruthy()
    expect(getByLabelText('Assistant')).toBeTruthy()
    expect(getByLabelText('Community')).toBeTruthy()
    expect(getByLabelText('Profile')).toBeTruthy()
  })
})

describe('TabBar — focused icon appearance', () => {
  it('renders focused icon with fill set and strokeWidth=0', () => {
    const props = makeTabBarProps({ activeIndex: 0 })
    const { getByTestId } = render(<TabBar {...props} />)
    const homeIcon = getByTestId('icon-home')
    expect(homeIcon.props.fill).toBeTruthy()
    expect(homeIcon.props.fill).not.toBe('none')
    expect(homeIcon.props.strokeWidth).toBe(0)
  })

  it('renders unfocused icon with fill="none" and strokeWidth=2', () => {
    const props = makeTabBarProps({ activeIndex: 0 })
    const { getByTestId } = render(<TabBar {...props} />)
    const learnIcon = getByTestId('icon-book-open')
    expect(learnIcon.props.fill).toBe('none')
    expect(learnIcon.props.strokeWidth).toBe(2)
  })

  it('shows indicator opacity=1 on focused tab and opacity=0 on unfocused tabs', () => {
    const props = makeTabBarProps({ activeIndex: 0 })
    const { getAllByTestId } = render(<TabBar {...props} />)
    const indicators = getAllByTestId('tab-indicator')
    expect(indicators[0]!.props.style?.opacity).toBe(1)
    indicators.slice(1).forEach((indicator) => {
      expect(indicator.props.style?.opacity).toBe(0)
    })
  })
})
