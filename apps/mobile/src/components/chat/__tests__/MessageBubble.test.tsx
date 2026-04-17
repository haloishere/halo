import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render } from '../../../test/render'
import { MessageBubble } from '../MessageBubble'

vi.mock('@tamagui/lucide-icons', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- vi.mock factory must use require
  const { Text } = require('react-native')
  return {
    ThumbsUp: (props: Record<string, unknown>) => <Text testID="icon-thumbs-up" {...props} />,
    ThumbsDown: (props: Record<string, unknown>) => <Text testID="icon-thumbs-down" {...props} />,
  }
})

vi.mock('lottie-react-native', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- vi.mock factory must use require
  const { View } = require('react-native')
  return {
    default: React.forwardRef((_props: Record<string, unknown>, _ref: unknown) => (
      <View testID="lottie-thinking" />
    )),
  }
})

describe('MessageBubble', () => {
  it('renders user message content', () => {
    const { getByText } = render(<MessageBubble role="user" content="Hello Halo" />)

    expect(getByText(/Hello Halo/)).toBeTruthy()
  })

  it('renders assistant message content', () => {
    const { getByText } = render(<MessageBubble role="assistant" content="I'm here to help" />)

    expect(getByText(/I'm here to help/)).toBeTruthy()
  })

  it('shows feedback buttons for assistant messages with onFeedback', () => {
    const onFeedback = vi.fn()
    const { getByLabelText } = render(
      <MessageBubble role="assistant" content="Response" onFeedback={onFeedback} />,
    )

    expect(getByLabelText('Thumbs up')).toBeTruthy()
    expect(getByLabelText('Thumbs down')).toBeTruthy()
  })

  it('does not show feedback buttons for user messages', () => {
    const { queryByLabelText } = render(<MessageBubble role="user" content="User message" />)

    expect(queryByLabelText('Thumbs up')).toBeNull()
  })

  it('does not show feedback buttons when streaming', () => {
    const onFeedback = vi.fn()
    const { queryByLabelText } = render(
      <MessageBubble role="assistant" content="Streaming..." onFeedback={onFeedback} isStreaming />,
    )

    expect(queryByLabelText('Thumbs up')).toBeNull()
  })

  it('shows ThinkingIndicator when streaming with no content', () => {
    const { getByTestId } = render(<MessageBubble role="assistant" content="" isStreaming />)

    expect(getByTestId('lottie-thinking')).toBeTruthy()
    expect(getByTestId('thinking-label')).toBeTruthy()
  })

  it('does not show ThinkingIndicator for user role when streaming with no content', () => {
    const { queryByTestId } = render(<MessageBubble role="user" content="" isStreaming />)

    expect(queryByTestId('lottie-thinking')).toBeNull()
    expect(queryByTestId('thinking-label')).toBeNull()
  })

  it('does not show ThinkingIndicator when not streaming even with empty content', () => {
    const { queryByTestId } = render(
      <MessageBubble role="assistant" content="" isStreaming={false} />,
    )

    expect(queryByTestId('lottie-thinking')).toBeNull()
  })

  it('thinking label has polite live region for screen readers', () => {
    const { getByTestId } = render(<MessageBubble role="assistant" content="" isStreaming />)

    const label = getByTestId('thinking-label')
    expect(label.props.accessibilityLiveRegion).toBe('polite')
    expect(label.props.accessibilityLabel).toBe('Halo is thinking')
  })
})
