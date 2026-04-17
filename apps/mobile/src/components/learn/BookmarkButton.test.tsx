import { describe, it, expect, vi } from 'vitest'
import { Text } from 'react-native'
import { fireEvent } from '@testing-library/react-native'
import { render } from '../../test/render'
import { BookmarkButton } from './BookmarkButton'

vi.mock('@tamagui/lucide-icons', () => ({
  Bookmark: (props: Record<string, unknown>) => <Text {...props}>BookmarkIcon</Text>,
  BookmarkCheck: (props: Record<string, unknown>) => <Text {...props}>BookmarkCheckIcon</Text>,
}))

describe('BookmarkButton', () => {
  it('shows Bookmark icon when not bookmarked', () => {
    const { getByText } = render(
      <BookmarkButton isBookmarked={false} onToggle={vi.fn()} />,
    )
    expect(getByText('BookmarkIcon')).toBeTruthy()
  })

  it('shows BookmarkCheck icon when bookmarked', () => {
    const { getByText } = render(
      <BookmarkButton isBookmarked={true} onToggle={vi.fn()} />,
    )
    expect(getByText('BookmarkCheckIcon')).toBeTruthy()
  })

  it('calls onToggle when pressed', () => {
    const onToggle = vi.fn()
    const { getByTestId } = render(
      <BookmarkButton isBookmarked={false} onToggle={onToggle} />,
    )
    fireEvent.press(getByTestId('bookmark-button'))
    expect(onToggle).toHaveBeenCalledOnce()
  })

  it('has correct accessibility label when not bookmarked', () => {
    const { getByLabelText } = render(
      <BookmarkButton isBookmarked={false} onToggle={vi.fn()} />,
    )
    expect(getByLabelText('Add bookmark')).toBeTruthy()
  })

  it('has correct accessibility label when bookmarked', () => {
    const { getByLabelText } = render(
      <BookmarkButton isBookmarked={true} onToggle={vi.fn()} />,
    )
    expect(getByLabelText('Remove bookmark')).toBeTruthy()
  })
})
