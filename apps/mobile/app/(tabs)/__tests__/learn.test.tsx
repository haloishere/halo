import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { Text } from 'react-native'
import { fireEvent } from '@testing-library/react-native'
import { render } from '../../../src/test/render'
import LearnScreen from '../learn'

vi.mock('expo-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@tamagui/toast', () => ({
  useToastController: () => ({ show: vi.fn() }),
}))

vi.mock('@tamagui/lucide-icons', () => ({
  Search: (props: Record<string, unknown>) => <Text {...props}>SearchIcon</Text>,
  BookOpen: (props: Record<string, unknown>) => <Text {...props}>BookOpenIcon</Text>,
  Bookmark: (props: Record<string, unknown>) => <Text {...props}>BookmarkIcon</Text>,
  BookmarkCheck: (props: Record<string, unknown>) => <Text {...props}>BookmarkCheckIcon</Text>,
  Play: (props: Record<string, unknown>) => <Text {...props}>PlayIcon</Text>,
  X: (props: Record<string, unknown>) => <Text {...props}>XIcon</Text>,
  ChevronRight: (props: Record<string, unknown>) => <Text {...props}>ChevronRightIcon</Text>,
  ChevronLeft: (props: Record<string, unknown>) => <Text {...props}>ChevronLeftIcon</Text>,
  GraduationCap: (props: Record<string, unknown>) => <Text {...props}>GraduationCapIcon</Text>,
  Target: (props: Record<string, unknown>) => <Text {...props}>TargetIcon</Text>,
  TrendingUp: (props: Record<string, unknown>) => <Text {...props}>TrendingUpIcon</Text>,
  Award: (props: Record<string, unknown>) => <Text {...props}>AwardIcon</Text>,
}))

vi.mock('../../../src/api/content', () => ({
  useBrowseContentQuery: () => ({
    data: [
      {
        id: '1',
        title: 'Test Article',
        slug: 'test-article',
        snippet: 'Test...',
        category: 'daily_care',
        diagnosisStages: ['early'],
        videoUrl: null,
        thumbnailUrl: null,
        isBookmarked: false,
        progressPercent: null,
        publishedAt: '2026-01-01',
        createdAt: '2026-01-01',
      },
    ],
    isLoading: false,
    isError: false,
    isRefetching: false,
    refetch: vi.fn(),
  }),
  useContentQuery: () => ({
    data: { pages: [{ items: [], nextCursor: null }] },
    isLoading: false,
    isRefetching: false,
    refetch: vi.fn(),
    fetchNextPage: vi.fn(),
    hasNextPage: false,
  }),
  useBookmarksQuery: () => ({
    data: { pages: [{ items: [], nextCursor: null }] },
    isLoading: false,
    isRefetching: false,
    refetch: vi.fn(),
    fetchNextPage: vi.fn(),
    hasNextPage: false,
  }),
  useToggleBookmark: () => ({
    mutate: vi.fn(),
  }),
}))

vi.mock('../../../src/hooks/useDebounce', () => ({
  useDebounce: (value: string) => value,
}))

describe('LearnScreen', () => {
  it('renders all 4 tab labels', () => {
    const { getByText } = render(<LearnScreen />)
    expect(getByText('For You')).toBeTruthy()
    expect(getByText('Topics')).toBeTruthy()
    expect(getByText('Bookmarks')).toBeTruthy()
    expect(getByText('Learning Path')).toBeTruthy()
  })

  it('shows For You tab content by default', () => {
    const { getByLabelText } = render(<LearnScreen />)
    expect(getByLabelText('Search articles')).toBeTruthy()
  })

  it('switches to Topics tab when pressed', () => {
    const { getByText } = render(<LearnScreen />)
    fireEvent.press(getByText('Topics'))
    expect(getByText('Daily Care')).toBeTruthy()
    expect(getByText('Safety')).toBeTruthy()
  })

  it('switches to Bookmarks tab when pressed', () => {
    const { getByText } = render(<LearnScreen />)
    fireEvent.press(getByText('Bookmarks'))
    expect(getByText('No bookmarked articles yet')).toBeTruthy()
  })

  it('switches to Learning Path tab when pressed', () => {
    const { getByText } = render(<LearnScreen />)
    fireEvent.press(getByText('Learning Path'))
    expect(getByText('Coming Soon')).toBeTruthy()
  })
})
