import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { Text } from 'react-native'
import { render } from '../../test/render'
import { ForYouTab } from './ForYouTab'
import type { ContentListItem } from '@halo/shared'

vi.mock('@tamagui/lucide-icons', () => ({
  Search: (props: Record<string, unknown>) => <Text {...props}>SearchIcon</Text>,
  BookOpen: (props: Record<string, unknown>) => <Text {...props}>BookOpenIcon</Text>,
  X: (props: Record<string, unknown>) => <Text {...props}>XIcon</Text>,
  ChevronRight: (props: Record<string, unknown>) => <Text {...props}>ChevronRightIcon</Text>,
  Bookmark: (props: Record<string, unknown>) => <Text {...props}>BookmarkIcon</Text>,
  BookmarkCheck: (props: Record<string, unknown>) => <Text {...props}>BookmarkCheckIcon</Text>,
  Play: (props: Record<string, unknown>) => <Text {...props}>PlayIcon</Text>,
}))

vi.mock('../../hooks/useDebounce', () => ({
  useDebounce: (value: string) => value,
}))

const makeItem = (overrides: Partial<ContentListItem> = {}): ContentListItem => ({
  id: 'item-1',
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
  ...overrides,
})

const mockItems = [
  makeItem({ id: '1', title: 'Daily Routine Tips', category: 'daily_care' }),
  makeItem({ id: '2', title: 'Self Care Guide', category: 'self_care' }),
  makeItem({ id: '3', title: 'Understanding Alzheimers', category: 'understanding_disease' }),
]

const defaultProps = {
  items: mockItems,
  isLoading: false,
  isError: false,
  isRefetching: false,
  onRefresh: vi.fn(),
  onArticlePress: vi.fn(),
  onBookmarkToggle: vi.fn(),
}

describe('ForYouTab', () => {
  it('renders search input', () => {
    const { getByLabelText } = render(<ForYouTab {...defaultProps} />)
    expect(getByLabelText('Search articles')).toBeTruthy()
  })

  it('renders category chips', () => {
    const { getByText } = render(<ForYouTab {...defaultProps} />)
    expect(getByText('All')).toBeTruthy()
  })

  it('renders section headings', () => {
    const { getByText } = render(<ForYouTab {...defaultProps} />)
    expect(getByText('Top Picks')).toBeTruthy()
    expect(getByText('Better Care')).toBeTruthy()
  })

  it('renders article cards from items', () => {
    const { getAllByText } = render(<ForYouTab {...defaultProps} />)
    expect(getAllByText('Daily Routine Tips').length).toBeGreaterThanOrEqual(1)
    expect(getAllByText('Self Care Guide').length).toBeGreaterThanOrEqual(1)
  })

  it('does not show empty state when loading', () => {
    const { queryByText } = render(<ForYouTab {...defaultProps} items={[]} isLoading={true} />)
    expect(queryByText('No articles found')).toBeNull()
  })

  it('shows empty state when no items and not loading', () => {
    const { getByText } = render(<ForYouTab {...defaultProps} items={[]} />)
    expect(getByText('No articles found')).toBeTruthy()
  })

  it('shows error message when query failed', () => {
    const { getByText } = render(<ForYouTab {...defaultProps} items={[]} isError={true} />)
    expect(getByText('Failed to load articles')).toBeTruthy()
  })
})
