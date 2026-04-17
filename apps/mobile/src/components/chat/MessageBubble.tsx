import { styled, XStack, YStack, Text, Button, Theme } from 'tamagui'
import { ThumbsUp, ThumbsDown } from '@tamagui/lucide-icons'
import type { FeedbackRating } from '@halo/shared'
import { ThinkingIndicator } from './ThinkingIndicator'

const BubbleRow = styled(XStack, {
  paddingHorizontal: '$3',
  paddingVertical: '$1',

  variants: {
    align: {
      end: { justifyContent: 'flex-end' },
      start: { justifyContent: 'flex-start' },
    },
  } as const,
})

const BubbleCard = styled(YStack, {
  borderRadius: '$5',
  padding: '$3',
  maxWidth: '80%',

  variants: {
    variant: {
      user: { backgroundColor: '$color8' },
      assistant: { backgroundColor: '$color4' },
    },
  } as const,
})

const BubbleText = styled(Text, {
  fontSize: '$4',
  lineHeight: '$4',

  variants: {
    variant: {
      user: { color: '$color1' },
      assistant: { color: '$color' },
    },
  } as const,
})

const FeedbackButton = styled(Button, {
  size: '$2',
  chromeless: true,
  circular: true,
})

export interface MessageBubbleProps {
  role: 'user' | 'assistant'
  content: string
  feedbackRating?: FeedbackRating | null
  onFeedback?: (rating: FeedbackRating) => void
  isStreaming?: boolean
}

export function MessageBubble({
  role,
  content,
  feedbackRating,
  onFeedback,
  isStreaming = false,
}: MessageBubbleProps) {
  const isUser = role === 'user'

  // Thinking state: streaming has started but no tokens have arrived yet (assistant only)
  const isThinking = isStreaming && !content && role === 'assistant'

  // While thinking, render the indicator directly (no bubble card background or padding)
  if (isThinking) {
    return (
      <BubbleRow align="start">
        <ThinkingIndicator />
      </BubbleRow>
    )
  }

  const bubble = (
    <BubbleCard variant={role}>
      <BubbleText variant={role}>{content}</BubbleText>

      {role === 'assistant' && !isStreaming && onFeedback && (
        <XStack gap="$2" marginTop="$2" justifyContent="flex-end">
          <FeedbackButton
            onPress={() => onFeedback('thumbs_up')}
            opacity={feedbackRating === 'thumbs_up' ? 1 : 0.4}
            accessibilityLabel="Thumbs up"
          >
            <ThumbsUp size={14} />
          </FeedbackButton>
          <FeedbackButton
            onPress={() => onFeedback('thumbs_down')}
            opacity={feedbackRating === 'thumbs_down' ? 1 : 0.4}
            accessibilityLabel="Thumbs down"
          >
            <ThumbsDown size={14} />
          </FeedbackButton>
        </XStack>
      )}
    </BubbleCard>
  )

  return (
    <BubbleRow align={isUser ? 'end' : 'start'}>
      {isUser ? <Theme name="accent">{bubble}</Theme> : bubble}
    </BubbleRow>
  )
}
