import { describe, it, expect, vi } from 'vitest'
import { Text } from 'react-native'
import { fireEvent } from '@testing-library/react-native'
import { render } from '../../test/render'
import { ForYouSection } from './ForYouSection'
import type { ContentListItem } from '@halo/shared'

vi.mock('@tamagui/lucide-icons', () => ({
  ChevronRight: (props: Record<string, unknown>) => <Text {...props}>ChevronRightIcon</Text>,
  Bookmark: (props: Record<string, unknown>) => <Text {...props}>BookmarkIcon</Text>,
  BookmarkCheck: (props: Record<string, unknown>) => <Text {...props}>BookmarkCheckIcon</Text>,
  Play: (props: Record<string, unknown>) => <Text {...props}>PlayIcon</Text>,
}))

const makeItem = (overrides: Partial<ContentListItem> = {}): ContentListItem => ({
  id: 'item-1',
  title: 'Test Article',
  slug: 'test-article',
  snippet: 'Test snippet...',
  category: 'daily_care',
  diagnosisStages: ['early'],
  videoUrl: null,
  thumbnailUrl: null,
  isBookmarked: false,
  progressPercent: null,
  publishedAt: '2026-01-01T00:00:00Z',
  createdAt: '2026-01-01T00:00:00Z',
  ...overrides,
})

const defaultProps = {
  title: 'Better Care',
  items: [
    makeItem({ id: 'item-1', title: 'Article One' }),
    makeItem({ id: 'item-2', title: 'Article Two' }),
  ],
  onArticlePress: vi.fn(),
  onBookmarkToggle: vi.fn(),
}

describe('ForYouSection', () => {
  it('renders section title', () => {
    const { getByText } = render(<ForYouSection {...defaultProps} />)
    expect(getByText('Better Care')).toBeTruthy()
  })

  it('renders article cards', () => {
    const { getAllByTestId } = render(<ForYouSection {...defaultProps} />)
    expect(getAllByTestId('horizontal-article-card')).toHaveLength(2)
  })

  it('does not render when items array is empty', () => {
    const { queryByText } = render(<ForYouSection {...defaultProps} items={[]} />)
    expect(queryByText('Better Care')).toBeNull()
  })

  it('shows See All button when onSeeAll is provided', () => {
    const onSeeAll = vi.fn()
    const { getByText } = render(<ForYouSection {...defaultProps} onSeeAll={onSeeAll} />)
    expect(getByText('See All')).toBeTruthy()
  })

  it('does not show See All button when onSeeAll is not provided', () => {
    const { queryByText } = render(<ForYouSection {...defaultProps} />)
    expect(queryByText('See All')).toBeNull()
  })

  it('calls onSeeAll when See All is pressed', () => {
    const onSeeAll = vi.fn()
    const { getByLabelText } = render(<ForYouSection {...defaultProps} onSeeAll={onSeeAll} />)
    fireEvent.press(getByLabelText('See all Better Care articles'))
    expect(onSeeAll).toHaveBeenCalledOnce()
  })

  it('limits displayed items to MAX_SECTION_ITEMS (8)', () => {
    const manyItems = Array.from({ length: 12 }, (_, i) =>
      makeItem({ id: `item-${i}`, title: `Article ${i}` }),
    )
    const { getAllByTestId } = render(<ForYouSection {...defaultProps} items={manyItems} />)
    expect(getAllByTestId('horizontal-article-card')).toHaveLength(8)
  })
})
