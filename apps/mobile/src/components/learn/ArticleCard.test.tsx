import { describe, it, expect, vi } from 'vitest'
import { Text } from 'react-native'
import { fireEvent } from '@testing-library/react-native'
import { render } from '../../test/render'
import { ArticleCard } from './ArticleCard'

vi.mock('@tamagui/lucide-icons', () => ({
  Bookmark: (props: Record<string, unknown>) => <Text {...props}>BookmarkIcon</Text>,
  BookmarkCheck: (props: Record<string, unknown>) => <Text {...props}>BookmarkCheckIcon</Text>,
  Play: (props: Record<string, unknown>) => <Text {...props}>PlayIcon</Text>,
}))

const defaultProps = {
  title: 'Understanding Sundowning',
  snippet: 'Sundowning is a common behavior...',
  category: 'behavioral_management' as const,
  isBookmarked: false,
  onPress: vi.fn(),
  onBookmarkToggle: vi.fn(),
}

describe('ArticleCard', () => {
  it('renders title and snippet', () => {
    const { getByText } = render(<ArticleCard {...defaultProps} />)
    expect(getByText('Understanding Sundowning')).toBeTruthy()
    expect(getByText('Sundowning is a common behavior...')).toBeTruthy()
  })

  it('renders category badge', () => {
    const { getByText } = render(<ArticleCard {...defaultProps} />)
    expect(getByText('Behavioral Management')).toBeTruthy()
  })

  it('renders with pressable card wrapper', () => {
    const { getByTestId } = render(<ArticleCard {...defaultProps} />)
    expect(getByTestId('article-card')).toBeTruthy()
  })

  it('calls onBookmarkToggle when bookmark pressed', () => {
    const onBookmarkToggle = vi.fn()
    const { getByTestId } = render(
      <ArticleCard {...defaultProps} onBookmarkToggle={onBookmarkToggle} />,
    )
    fireEvent.press(getByTestId('bookmark-button'))
    expect(onBookmarkToggle).toHaveBeenCalled()
  })

  it('shows BookmarkCheck icon when bookmarked', () => {
    const { getByText } = render(<ArticleCard {...defaultProps} isBookmarked={true} />)
    expect(getByText('BookmarkCheckIcon')).toBeTruthy()
  })

  it('shows video icon when videoUrl and thumbnailUrl present', () => {
    const { getByText } = render(
      <ArticleCard
        {...defaultProps}
        videoUrl="https://youtube.com/watch?v=abc"
        thumbnailUrl="https://example.com/thumb.jpg"
      />,
    )
    expect(getByText('PlayIcon')).toBeTruthy()
  })

  it('does not show video icon when no videoUrl', () => {
    const { queryByText } = render(<ArticleCard {...defaultProps} />)
    expect(queryByText('PlayIcon')).toBeNull()
  })

  it('renders progress bar', () => {
    const { getByTestId } = render(<ArticleCard {...defaultProps} progressPercent={45} />)
    expect(getByTestId('article-progress')).toBeTruthy()
  })
})

describe('ArticleCard — horizontal layout', () => {
  const horizontalProps = {
    title: 'Understanding Sundowning',
    category: 'behavioral_management' as const,
    isBookmarked: false,
    onPress: vi.fn(),
    onBookmarkToggle: vi.fn(),
  }

  it('renders with horizontal-article-card testID', () => {
    const { getByTestId } = render(<ArticleCard {...horizontalProps} layout="horizontal" />)
    expect(getByTestId('horizontal-article-card')).toBeTruthy()
  })

  it('renders title and category badge', () => {
    const { getByText } = render(<ArticleCard {...horizontalProps} layout="horizontal" />)
    expect(getByText('Understanding Sundowning')).toBeTruthy()
    expect(getByText('Behavioral Management')).toBeTruthy()
  })

  it('does not render snippet in horizontal layout', () => {
    const { queryByText } = render(
      <ArticleCard {...horizontalProps} layout="horizontal" snippet="Some snippet" />,
    )
    expect(queryByText('Some snippet')).toBeNull()
  })

  it('has accessible label combining title and category', () => {
    const { getByLabelText } = render(<ArticleCard {...horizontalProps} layout="horizontal" />)
    expect(getByLabelText('Understanding Sundowning, Behavioral Management')).toBeTruthy()
  })

  it('calls onBookmarkToggle when bookmark pressed', () => {
    const onBookmarkToggle = vi.fn()
    const { getByTestId } = render(
      <ArticleCard {...horizontalProps} layout="horizontal" onBookmarkToggle={onBookmarkToggle} />,
    )
    fireEvent.press(getByTestId('bookmark-button'))
    expect(onBookmarkToggle).toHaveBeenCalledOnce()
  })
})

describe('ArticleCard — thumbnail rendering', () => {
  it('renders thumbnail when thumbnailUrl is provided', () => {
    const { getByTestId } = render(
      <ArticleCard {...defaultProps} thumbnailUrl="https://example.com/thumb.jpg" />,
    )
    expect(getByTestId('article-thumbnail')).toBeTruthy()
  })

  it('does not render thumbnail when thumbnailUrl is null', () => {
    const { queryByTestId } = render(<ArticleCard {...defaultProps} thumbnailUrl={null} />)
    expect(queryByTestId('article-thumbnail')).toBeNull()
  })

  it('does not render thumbnail when thumbnailUrl is undefined', () => {
    const { queryByTestId } = render(<ArticleCard {...defaultProps} />)
    expect(queryByTestId('article-thumbnail')).toBeNull()
  })
})
