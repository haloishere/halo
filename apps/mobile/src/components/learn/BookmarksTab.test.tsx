import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { Text } from 'react-native'
import { render } from '../../test/render'
import { BookmarksTab } from './BookmarksTab'

vi.mock('@tamagui/lucide-icons', () => ({
  Bookmark: (props: Record<string, unknown>) => <Text {...props}>BookmarkIcon</Text>,
  BookmarkCheck: (props: Record<string, unknown>) => <Text {...props}>BookmarkCheckIcon</Text>,
  Play: (props: Record<string, unknown>) => <Text {...props}>PlayIcon</Text>,
}))

const defaultProps = {
  items: [],
  isLoading: false,
  isRefetching: false,
  hasNextPage: false as boolean | undefined,
  onFetchNextPage: vi.fn(),
  onRefresh: vi.fn(),
  onArticlePress: vi.fn(),
  onBookmarkToggle: vi.fn(),
}

describe('BookmarksTab', () => {
  it('shows empty state when no bookmarks', () => {
    const { getByText } = render(<BookmarksTab {...defaultProps} />)
    expect(getByText('No bookmarked articles yet')).toBeTruthy()
    expect(getByText('Bookmark articles to find them here')).toBeTruthy()
  })

  it('renders bookmarked article when items provided', () => {
    const { getByText } = render(
      <BookmarksTab
        {...defaultProps}
        items={[
          {
            id: 'bm-1',
            title: 'Saved Article',
            slug: 'saved-article',
            snippet: 'A saved article...',
            category: 'self_care',
            diagnosisStages: ['early'],
            videoUrl: null,
            thumbnailUrl: null,
            isBookmarked: true,
            progressPercent: 50,
            publishedAt: '2026-01-01',
            createdAt: '2026-01-01',
          },
        ]}
      />,
    )
    expect(getByText('Saved Article')).toBeTruthy()
  })
})
