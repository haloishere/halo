import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { Text } from 'react-native'
import { render } from '../../../src/test/render'
import ArticleDetailScreen from '../[slug]'

vi.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ slug: 'test-article' }),
  Stack: { Screen: () => null },
  router: { back: vi.fn() },
}))

vi.mock('@tamagui/toast', () => ({
  useToastController: () => ({ show: vi.fn() }),
}))

vi.mock('@tamagui/lucide-icons', () => ({
  ChevronLeft: (props: Record<string, unknown>) => <Text {...props}>BackIcon</Text>,
  Bookmark: (props: Record<string, unknown>) => <Text {...props}>BookmarkIcon</Text>,
  BookmarkCheck: (props: Record<string, unknown>) => <Text {...props}>BookmarkCheckIcon</Text>,
}))

const mockArticle = {
  id: 'item-1',
  title: 'Understanding Sundowning',
  slug: 'test-article',
  body: '# Sundowning\n\nContent here...',
  category: 'behavioral_management',
  diagnosisStages: ['middle', 'late'],
  videoUrl: null,
  thumbnailUrl: null,
  authorId: null,
  publishedAt: '2024-01-01T00:00:00Z',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  isBookmarked: false,
  progressPercent: 0,
}

vi.mock('../../../src/api/content', () => ({
  useContentBySlugQuery: () => ({
    data: mockArticle,
    isLoading: false,
    isError: false,
  }),
  useToggleBookmark: () => ({ mutate: vi.fn() }),
  useUpdateProgress: () => ({ mutate: vi.fn() }),
}))

vi.mock('../../../src/hooks/useReadingProgress', () => ({
  useReadingProgress: () => ({ progress: 0, onScroll: vi.fn() }),
}))

describe('ArticleDetailScreen', () => {
  it('renders article title', () => {
    const { getAllByText } = render(<ArticleDetailScreen />)
    // Title appears in both header and body
    expect(getAllByText('Understanding Sundowning').length).toBeGreaterThanOrEqual(1)
  })

  it('renders category badge', () => {
    const { getByText } = render(<ArticleDetailScreen />)
    expect(getByText('Behavioral Management')).toBeTruthy()
  })

  it('renders reading time', () => {
    const { getByText } = render(<ArticleDetailScreen />)
    expect(getByText('1 min read')).toBeTruthy()
  })

  it('renders markdown content', () => {
    const { getByTestId } = render(<ArticleDetailScreen />)
    expect(getByTestId('markdown-display')).toBeTruthy()
  })

  it('renders back button', () => {
    const { getByLabelText } = render(<ArticleDetailScreen />)
    expect(getByLabelText('Go back')).toBeTruthy()
  })

  it('renders bookmark button', () => {
    const { getByLabelText } = render(<ArticleDetailScreen />)
    expect(getByLabelText('Add bookmark')).toBeTruthy()
  })
})
