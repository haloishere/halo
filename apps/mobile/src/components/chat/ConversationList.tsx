import { FlatList, RefreshControl } from 'react-native'
import { styled, YStack, XStack, Text, Button, Spinner, Theme } from 'tamagui'
import { MessageCircle, Plus, Trash2 } from '@tamagui/lucide-icons'
import type { AiConversation } from '@halo/shared'

const CenteredContainer = styled(YStack, {
  flex: 1,
  justifyContent: 'center',
  alignItems: 'center',
})

const EmptyContainer = styled(CenteredContainer, {
  padding: '$6',
  gap: '$4',
})

const EmptyText = styled(Text, {
  color: '$color8',
  textAlign: 'center',

  variants: {
    variant: {
      title: { fontSize: '$5' },
      body: { fontSize: '$3' },
    },
  } as const,
})

const Row = styled(XStack, {
  paddingHorizontal: '$4',
  paddingVertical: '$3',
  gap: '$3',
  alignItems: 'center',
})

const RowContent = styled(XStack, {
  flex: 1,
  gap: '$3',
  alignItems: 'center',
  pressStyle: { opacity: 0.7 },
})

const RowTitle = styled(Text, {
  fontSize: '$4',
  fontWeight: '500',
})

const RowDate = styled(Text, {
  fontSize: '$2',
  color: '$color8',
})

const DeleteButton = styled(Button, {
  size: '$2',
  chromeless: true,
  circular: true,
})

// TODO(tamagui-v2-stable): Spread pattern bypasses Tamagui v2 RC type gap on Button's `color` prop
const newChatButtonStyle = {
  backgroundColor: '$color8',
  color: '$color1',
} as Record<string, unknown>

export interface ConversationListProps {
  conversations: AiConversation[]
  isLoading: boolean
  isRefreshing: boolean
  onRefresh: () => void
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onCreateNew: () => void
  onLoadMore?: () => void
  hasMore?: boolean
}

export function ConversationList({
  conversations,
  isLoading,
  isRefreshing,
  onRefresh,
  onSelect,
  onDelete,
  onCreateNew,
  onLoadMore,
  hasMore,
}: ConversationListProps) {
  if (isLoading && conversations.length === 0) {
    return (
      <CenteredContainer>
        <Spinner size="large" color="$accent9" />
      </CenteredContainer>
    )
  }

  if (conversations.length === 0) {
    return (
      <EmptyContainer>
        <MessageCircle size={48} color="$color8" />
        <EmptyText variant="title">No conversations yet</EmptyText>
        <EmptyText variant="body">Start a new chat with Halo for caregiver support</EmptyText>
        <Theme name="accent">
          <Button
            size="$4"
            onPress={onCreateNew}
            icon={<Plus size={18} color="$color1" />}
            {...newChatButtonStyle}
          >
            New Chat
          </Button>
        </Theme>
      </EmptyContainer>
    )
  }

  return (
    <FlatList
      data={conversations}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <ConversationRow
          conversation={item}
          onSelect={() => onSelect(item.id)}
          onDelete={() => onDelete(item.id)}
        />
      )}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
      onEndReached={hasMore ? onLoadMore : undefined}
      onEndReachedThreshold={0.5}
      contentContainerStyle={{ paddingVertical: 8 }}
    />
  )
}

interface ConversationRowProps {
  conversation: AiConversation
  onSelect: () => void
  onDelete: () => void
}

function ConversationRow({ conversation, onSelect, onDelete }: ConversationRowProps) {
  const date = new Date(conversation.createdAt)
  const dateStr = date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <Row>
      <RowContent onPress={onSelect} accessibilityRole="button">
        <MessageCircle size={20} color="$color" />
        <YStack flex={1}>
          <RowTitle numberOfLines={1}>{conversation.title ?? 'Untitled Chat'}</RowTitle>
          <RowDate>{dateStr}</RowDate>
        </YStack>
      </RowContent>
      <DeleteButton onPress={onDelete} accessibilityLabel="Delete conversation">
        <Trash2 size={16} color="$red9" />
      </DeleteButton>
    </Row>
  )
}
