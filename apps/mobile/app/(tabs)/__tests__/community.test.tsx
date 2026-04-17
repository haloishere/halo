import React from 'react'
import { Text } from 'react-native'
import { describe, it, expect, vi } from 'vitest'
import { fireEvent } from '@testing-library/react-native'
import { render } from '../../../src/test/render'

const { mockPush } = vi.hoisted(() => ({
  mockPush: vi.fn(),
}))

vi.mock('@tamagui/lucide-icons', () => ({
  Plus: (props: Record<string, unknown>) => <Text {...props}>PlusIcon</Text>,
  MessageSquare: (props: Record<string, unknown>) => <Text {...props}>MessageSquareIcon</Text>,
  Users: (props: Record<string, unknown>) => <Text {...props}>UsersIcon</Text>,
  Star: (props: Record<string, unknown>) => <Text {...props}>StarIcon</Text>,
  TrendingUp: (props: Record<string, unknown>) => <Text {...props}>TrendingUpIcon</Text>,
  Heart: (props: Record<string, unknown>) => <Text {...props}>HeartIcon</Text>,
  MessageCircle: (props: Record<string, unknown>) => <Text {...props}>MessageCircleIcon</Text>,
}))

// Mock community API hooks
vi.mock('../../../src/api/community', () => ({
  useExploreFeedQuery: vi.fn().mockReturnValue({
    data: undefined,
    isLoading: true,
    isRefetching: false,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
  }),
  useFollowingFeedQuery: vi.fn().mockReturnValue({
    data: undefined,
    isLoading: true,
    isRefetching: false,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
  }),
  useSpotlightQuery: vi.fn().mockReturnValue({
    data: undefined,
    isLoading: true,
    isRefetching: false,
    refetch: vi.fn(),
  }),
  useTogglePostLike: vi.fn().mockReturnValue({ mutate: vi.fn() }),
}))

vi.mock('expo-router', () => ({
  useRouter: vi.fn().mockReturnValue({ push: mockPush, back: vi.fn() }),
}))

import CommunityScreen from '../community'

describe('CommunityScreen', () => {
  it('renders the tab bar', () => {
    const { getByText } = render(<CommunityScreen />)
    expect(getByText('Explore')).toBeTruthy()
    expect(getByText('Following')).toBeTruthy()
    expect(getByText('Spotlight')).toBeTruthy()
  })

  it('renders the FAB with Create post label', () => {
    const { getByLabelText } = render(<CommunityScreen />)
    expect(getByLabelText('Create post')).toBeTruthy()
  })

  it('navigates to /community/create on FAB press', () => {
    mockPush.mockClear()
    const { getByLabelText } = render(<CommunityScreen />)
    fireEvent.press(getByLabelText('Create post'))
    expect(mockPush).toHaveBeenCalledWith('/community/create')
  })
})
