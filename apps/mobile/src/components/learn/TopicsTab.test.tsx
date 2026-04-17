import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { Text } from 'react-native'
import { fireEvent } from '@testing-library/react-native'
import { render } from '../../test/render'
import { TopicsTab } from './TopicsTab'

vi.mock('@tamagui/lucide-icons', () => ({
  ChevronRight: (props: Record<string, unknown>) => <Text {...props}>ChevronRightIcon</Text>,
  ChevronLeft: (props: Record<string, unknown>) => <Text {...props}>ChevronLeftIcon</Text>,
  BookOpen: (props: Record<string, unknown>) => <Text {...props}>BookOpenIcon</Text>,
  Bookmark: (props: Record<string, unknown>) => <Text {...props}>BookmarkIcon</Text>,
  BookmarkCheck: (props: Record<string, unknown>) => <Text {...props}>BookmarkCheckIcon</Text>,
  Play: (props: Record<string, unknown>) => <Text {...props}>PlayIcon</Text>,
}))

vi.mock('../../api/content', () => ({
  useContentQuery: () => ({
    data: { pages: [{ items: [], nextCursor: null }] },
    isLoading: false,
    isRefetching: false,
    refetch: vi.fn(),
    fetchNextPage: vi.fn(),
    hasNextPage: false,
  }),
}))

const defaultProps = {
  onArticlePress: vi.fn(),
  onBookmarkToggle: vi.fn(),
}

describe('TopicsTab — category list', () => {
  it('renders all 7 category rows', () => {
    const { getByText } = render(<TopicsTab {...defaultProps} />)
    expect(getByText('Daily Care')).toBeTruthy()
    expect(getByText('Safety')).toBeTruthy()
    expect(getByText('Self Care')).toBeTruthy()
    expect(getByText('Communication')).toBeTruthy()
    expect(getByText('Legal & Financial')).toBeTruthy()
    expect(getByText('Understanding the Disease')).toBeTruthy()
    expect(getByText('Behavioral Management')).toBeTruthy()
  })

  it('renders category rows with testIDs', () => {
    const { getByTestId } = render(<TopicsTab {...defaultProps} />)
    expect(getByTestId('topic-row-daily_care')).toBeTruthy()
    expect(getByTestId('topic-row-safety')).toBeTruthy()
  })

  it('transitions to article list when category is pressed', () => {
    const { getByText, getByLabelText } = render(<TopicsTab {...defaultProps} />)
    fireEvent.press(getByText('Daily Care'))
    expect(getByLabelText('Back to all topics')).toBeTruthy()
  })
})

describe('TopicsTab — filtered article list', () => {
  it('shows back button with category name', () => {
    const { getByText, getByLabelText } = render(<TopicsTab {...defaultProps} />)
    fireEvent.press(getByText('Safety'))
    expect(getByLabelText('Back to all topics')).toBeTruthy()
    expect(getByText('Safety')).toBeTruthy()
  })

  it('returns to category list when back is pressed', () => {
    const { getByText, getByLabelText } = render(<TopicsTab {...defaultProps} />)
    fireEvent.press(getByText('Safety'))
    fireEvent.press(getByLabelText('Back to all topics'))
    expect(getByText('Daily Care')).toBeTruthy()
    expect(getByText('Communication')).toBeTruthy()
  })

  it('shows empty state when no articles in category', () => {
    const { getByText } = render(<TopicsTab {...defaultProps} />)
    fireEvent.press(getByText('Safety'))
    expect(getByText('No articles in this category')).toBeTruthy()
  })
})
