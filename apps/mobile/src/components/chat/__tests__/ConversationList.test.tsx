import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent } from '@testing-library/react-native'
import { render } from '../../../test/render'
import { ConversationList } from '../ConversationList'
import type { AiConversation } from '@halo/shared'

vi.mock('@tamagui/lucide-icons', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- vi.mock factory must use require
  const { Text } = require('react-native')
  return {
    MessageCircle: (props: Record<string, unknown>) => (
      <Text testID="icon-message-circle" {...props} />
    ),
    Plus: (props: Record<string, unknown>) => <Text testID="icon-plus" {...props} />,
    Trash2: (props: Record<string, unknown>) => <Text testID="icon-trash" {...props} />,
  }
})

function makeConversation(overrides: Partial<AiConversation> = {}): AiConversation {
  return {
    id: 'conv-1',
    userId: 'user-1',
    title: 'Test Chat',
    summary: null,
    topic: 'food_and_restaurants',
    createdAt: '2024-01-15T10:30:00Z',
    updatedAt: '2024-01-15T10:30:00Z',
    ...overrides,
  }
}

let defaultProps: {
  conversations: AiConversation[]
  isLoading: boolean
  isRefreshing: boolean
  onRefresh: ReturnType<typeof vi.fn>
  onSelect: ReturnType<typeof vi.fn>
  onDelete: ReturnType<typeof vi.fn>
  onCreateNew: ReturnType<typeof vi.fn>
}

beforeEach(() => {
  defaultProps = {
    conversations: [],
    isLoading: false,
    isRefreshing: false,
    onRefresh: vi.fn(),
    onSelect: vi.fn(),
    onDelete: vi.fn(),
    onCreateNew: vi.fn(),
  }
})

describe('ConversationList', () => {
  it('shows spinner when loading and no conversations', () => {
    const { toJSON } = render(<ConversationList {...defaultProps} isLoading conversations={[]} />)

    expect(toJSON()).toBeTruthy()
  })

  it('shows empty state with "No conversations yet"', () => {
    const { getByText } = render(<ConversationList {...defaultProps} conversations={[]} />)

    expect(getByText('No conversations yet')).toBeTruthy()
  })

  it('shows "New Chat" button in empty state', () => {
    const { getByText } = render(<ConversationList {...defaultProps} conversations={[]} />)

    expect(getByText('New Chat')).toBeTruthy()
  })

  it('renders conversation rows with title', () => {
    const conversations = [makeConversation({ id: 'c1', title: 'My Chat' })]
    const { getByText } = render(
      <ConversationList {...defaultProps} conversations={conversations} />,
    )

    expect(getByText('My Chat')).toBeTruthy()
  })

  it('shows "Untitled Chat" for conversations with null title', () => {
    const conversations = [makeConversation({ id: 'c1', title: null })]
    const { getByText } = render(
      <ConversationList {...defaultProps} conversations={conversations} />,
    )

    expect(getByText('Untitled Chat')).toBeTruthy()
  })

  it('renders delete button with accessibility label', () => {
    const conversations = [makeConversation({ id: 'c1' })]
    const { getByLabelText } = render(
      <ConversationList {...defaultProps} conversations={conversations} />,
    )

    expect(getByLabelText('Delete conversation')).toBeTruthy()
  })

  it('calls onDelete with conversation id when delete button is pressed', () => {
    const conversations = [makeConversation({ id: 'c1' })]
    const { getByLabelText } = render(
      <ConversationList {...defaultProps} conversations={conversations} />,
    )
    fireEvent.press(getByLabelText('Delete conversation'))
    expect(defaultProps.onDelete).toHaveBeenCalledWith('c1')
  })

  it('calls onSelect when row content is pressed', () => {
    const conversations = [makeConversation({ id: 'c1', title: 'My Chat' })]
    const { getByText } = render(
      <ConversationList {...defaultProps} conversations={conversations} />,
    )
    fireEvent.press(getByText('My Chat'))
    expect(defaultProps.onSelect).toHaveBeenCalledWith('c1')
  })

  it('does not call onSelect when delete button is pressed', () => {
    const conversations = [makeConversation({ id: 'c1' })]
    const { getByLabelText } = render(
      <ConversationList {...defaultProps} conversations={conversations} />,
    )
    fireEvent.press(getByLabelText('Delete conversation'))
    expect(defaultProps.onSelect).not.toHaveBeenCalled()
  })
})
