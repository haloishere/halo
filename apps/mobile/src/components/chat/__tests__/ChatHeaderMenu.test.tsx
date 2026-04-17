import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Text } from 'tamagui'
import { render, fireEvent } from '../../../test/render'
import { ChatHeaderMenu } from '../ChatHeaderMenu'

// Real lucide icons pull Tamagui theme context that crashes in Node test env.
// Mirror the HeaderBar test pattern: render text markers so queries still work.
vi.mock('@tamagui/lucide-icons', () => ({
  Plus: () => <Text>[plus-icon]</Text>,
  MessageSquarePlus: () => <Text>[new-chat-icon]</Text>,
  History: () => <Text>[history-icon]</Text>,
}))

let defaultProps: {
  onNewChat: ReturnType<typeof vi.fn>
  onHistory: ReturnType<typeof vi.fn>
}

beforeEach(() => {
  defaultProps = {
    onNewChat: vi.fn(),
    onHistory: vi.fn(),
  }
})

describe('ChatHeaderMenu — trigger', () => {
  it('renders the trigger with accessibility label', () => {
    const { getByLabelText } = render(<ChatHeaderMenu {...defaultProps} />)
    expect(getByLabelText('Chat menu')).toBeTruthy()
  })

  it('does not render menu items before the trigger is pressed', () => {
    const { queryByText } = render(<ChatHeaderMenu {...defaultProps} />)
    expect(queryByText('New Chat')).toBeNull()
    expect(queryByText('Chat History')).toBeNull()
  })

  it('opens the menu when the trigger is pressed', () => {
    const { getByLabelText, getByText } = render(<ChatHeaderMenu {...defaultProps} />)
    fireEvent.press(getByLabelText('Chat menu'))
    expect(getByText('New Chat')).toBeTruthy()
    expect(getByText('Chat History')).toBeTruthy()
  })
})

describe('ChatHeaderMenu — actions', () => {
  it('calls onNewChat and closes the menu when "New Chat" is pressed', () => {
    const { getByLabelText, getByText, queryByText } = render(<ChatHeaderMenu {...defaultProps} />)
    fireEvent.press(getByLabelText('Chat menu'))
    fireEvent.press(getByText('New Chat'))
    expect(defaultProps.onNewChat).toHaveBeenCalledOnce()
    expect(defaultProps.onHistory).not.toHaveBeenCalled()
    expect(queryByText('New Chat')).toBeNull()
  })

  it('calls onHistory and closes the menu when "Chat History" is pressed', () => {
    const { getByLabelText, getByText, queryByText } = render(<ChatHeaderMenu {...defaultProps} />)
    fireEvent.press(getByLabelText('Chat menu'))
    fireEvent.press(getByText('Chat History'))
    expect(defaultProps.onHistory).toHaveBeenCalledOnce()
    expect(defaultProps.onNewChat).not.toHaveBeenCalled()
    expect(queryByText('Chat History')).toBeNull()
  })
})

describe('ChatHeaderMenu — dismissal', () => {
  it('closes when the backdrop is pressed', () => {
    const { getByLabelText, getByTestId, queryByText } = render(
      <ChatHeaderMenu {...defaultProps} />,
    )
    fireEvent.press(getByLabelText('Chat menu'))
    fireEvent.press(getByTestId('chat-header-menu-overlay'))
    expect(queryByText('New Chat')).toBeNull()
    expect(defaultProps.onNewChat).not.toHaveBeenCalled()
    expect(defaultProps.onHistory).not.toHaveBeenCalled()
  })
})

describe('ChatHeaderMenu — accessibility', () => {
  it('trigger has button role', () => {
    const { getByLabelText } = render(<ChatHeaderMenu {...defaultProps} />)
    const trigger = getByLabelText('Chat menu')
    expect(trigger.props.accessibilityRole).toBe('button')
  })

  it('menu items have button role once opened', () => {
    const { getByLabelText } = render(<ChatHeaderMenu {...defaultProps} />)
    fireEvent.press(getByLabelText('Chat menu'))
    expect(getByLabelText('New Chat').props.accessibilityRole).toBe('button')
    expect(getByLabelText('Chat History').props.accessibilityRole).toBe('button')
  })
})
