import { useCallback, useEffect, useRef } from 'react'
import { FlatList, Platform } from 'react-native'
import { KeyboardAvoidingView } from 'react-native-keyboard-controller'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import { styled, YStack, Text, Spinner, AnimatePresence } from 'tamagui'
import { useQueryClient } from '@tanstack/react-query'
import { useConversationQuery, useSubmitFeedback } from '../../../src/api/ai-chat'
import { useAiChat } from '../../../src/hooks/useAiChat'
import { useChatStore } from '../../../src/stores/chat'
import { useAuthStore } from '../../../src/stores/auth'
import { useLastChatStore } from '../../../src/stores/last-chat'
import { NEW_CHAT_SENTINEL } from '../../../src/lib/chat-resume'
import { MessageBubble } from '../../../src/components/chat/MessageBubble'
import { MessageInput } from '../../../src/components/chat/MessageInput'
import { CrisisResources } from '../../../src/components/chat/CrisisResources'
import { WelcomeGreeting } from '../../../src/components/chat/WelcomeGreeting'
import { ChatHeaderMenu } from '../../../src/components/chat/ChatHeaderMenu'
import { HeaderBar } from '../../../src/components/ui/HeaderBar'
import type { FeedbackRating, AiMessage } from '@halo/shared'

type DisplayMessage =
  | AiMessage
  | { id: string; role: 'user' | 'assistant'; content: string; isStreaming?: true }

const ErrorBanner = styled(Text, {
  color: '$red9',
  fontSize: '$3',
  paddingHorizontal: '$3',
  paddingVertical: '$1',
  textAlign: 'center',
})

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const conversationId = id ?? null
  // When the loader routed us to the `/chat/new` sentinel, the backend
  // does NOT have a row yet — the conversation will be lazy-created by
  // `useAiChat` only when the user actually types and hits send. For
  // the duration of this "new chat" state we disable `useConversationQuery`
  // (which would otherwise 404) and render the welcome/empty state
  // locally. Once lazy creation fires, we receive the real id via
  // `onConversationCreated` and call router.setParams({ id: realId }),
  // causing this screen to re-render in-place with the real id.
  const isNewChat = conversationId === NEW_CHAT_SENTINEL
  const conversationIdForQuery = isNewChat ? null : conversationId

  const router = useRouter()
  const queryClient = useQueryClient()
  const {
    data: conversation,
    isLoading,
    isError: isConversationError,
  } = useConversationQuery(conversationIdForQuery)
  const { sendMessage, cancelStream } = useAiChat(conversationId, {
    onConversationCreated: (realId) => {
      // Swap the sentinel param for the real id so subsequent renders
      // read the real id via useLocalSearchParams.
      //
      // IMPORTANT: use `setParams` NOT `router.replace`. In React Navigation,
      // `replace` creates a new route entry (new key) which UNMOUNTS the
      // current screen and MOUNTS a new one — triggering the unmount cleanup
      // effect that calls `cancelStream()`, aborting the in-flight XHR and
      // wiping `pendingUserMessage`/`streamingMessage` from the chat store.
      // `setParams` mutates the current route's params in-place (re-render
      // only, no unmount) so the stream and the optimistic UI survive intact.
      router.setParams({ id: realId })
    },
  })
  const {
    pendingUserMessage,
    streamingMessage,
    isStreaming,
    streamError,
    crisisResources,
    setActiveConversation,
  } = useChatStore()
  const dbUser = useAuthStore((s) => s.dbUser)
  const setLastChat = useLastChatStore((s) => s.setLastChat)
  const clearLastChat = useLastChatStore((s) => s.clearLastChat)
  const submitFeedback = useSubmitFeedback()
  const flatListRef = useRef<FlatList>(null)

  // Effect 1: track the active conversation on every id change AND
  // persist the real id + current timestamp to `useLastChatStore` so
  // the Chat tab redirect can send the user back here on re-entry.
  // Sentinel (`/chat/new`) is deliberately skipped — no row exists
  // yet, there's nothing to resume to.
  useEffect(() => {
    setActiveConversation(isNewChat ? null : conversationId)
    if (!isNewChat && conversationId) {
      setLastChat(conversationId, Date.now())
    }
  }, [conversationId, isNewChat, setActiveConversation, setLastChat])

  // Effect 1b: when the server reports the conversation no longer exists
  // (deleted from the history screen, deleted on another device, or any
  // other 404/error), clear the persisted last-chat pointer AND navigate
  // to the new-chat sentinel in-place.
  //
  // Using `router.setParams` keeps the component mounted (no unmount/
  // remount) so this runs cleanly while the history screen may still be
  // on top of the stack. When the user presses back from history they
  // land on a fresh empty chat rather than a broken screen that will
  // always fail to send ("conversation not found").
  useEffect(() => {
    if (isConversationError && !isNewChat) {
      clearLastChat()
      router.setParams({ id: NEW_CHAT_SENTINEL })
    }
  }, [isConversationError, isNewChat, clearLastChat, router])

  // Effect 2: unmount-only cleanup. MUST NOT depend on `conversationId`.
  //
  // The sentinel→realId transition uses `router.setParams` (in-place param
  // update, no unmount) so this cleanup does NOT fire during that transition.
  // If it used `router.replace` (which unmounts the screen), `cancelStream()`
  // would abort the in-flight XHR and silently drop the user's first message.
  //
  // The deps listed here are all stable in production:
  //   - `cancelStream` is useCallback-wrapped in useAiChat over stable Zustand actions
  //   - `setActiveConversation` is a Zustand action (stable by identity)
  //   - `queryClient` is the singleton from QueryClientProvider in _layout.tsx
  // so the effect runs exactly once on mount and cleanup fires exactly once
  // on unmount. Do NOT add `conversationId` / `isNewChat` back into this dep
  // list — the whole point of this split is that the id can change without
  // triggering cleanup.
  useEffect(() => {
    return () => {
      cancelStream()
      setActiveConversation(null)
      // Refresh conversation list so auto-generated titles appear immediately
      queryClient.invalidateQueries({ queryKey: ['ai', 'conversations'] })
    }
  }, [cancelStream, setActiveConversation, queryClient])

  const handleFeedback = useCallback(
    (messageId: string, rating: FeedbackRating) => {
      // Defensive guard: under normal flow, feedback buttons only render
      // for non-streaming real assistant messages from the server-side
      // `useConversationQuery` fetch — which is DISABLED while
      // `isNewChat` is true. So a tap can't reach this handler with
      // `conversationId === 'new'` in the current implementation.
      //
      // HOWEVER the reviewer flagged a timing edge case: if a future
      // refactor renders feedback UI before the query disables, or if
      // a slow render cycle leaves the sentinel id in `conversationId`
      // after the first assistant message has arrived, the handler
      // would fire with the sentinel and POST feedback to
      // `/v1/ai/conversations/new/feedback/...` which would 404.
      //
      // The `isNewChat` branch below defends against that class of
      // bug at zero runtime cost and makes the guard intent explicit.
      if (!conversationId || isNewChat) return
      submitFeedback.mutate({ conversationId, messageId, data: { rating } })
    },
    [conversationId, isNewChat, submitFeedback],
  )

  const messages: DisplayMessage[] = [
    ...(conversation?.messages ?? []),
    ...(pendingUserMessage
      ? [{ id: 'pending-user', role: 'user' as const, content: pendingUserMessage }]
      : []),
    ...(isStreaming || streamingMessage
      ? [
          {
            id: 'streaming',
            role: 'assistant' as const,
            content: streamingMessage,
            isStreaming: true as const,
          },
        ]
      : []),
  ]

  const reversedMessages = [...messages].reverse()

  // Welcome greeting visibility: empty conversation AND nothing in flight.
  // The `!conversation?.messages?.length` check doubles as the /chat/new
  // sentinel case because `conversation` is undefined when the query is
  // disabled. `pendingUserMessage` and `isStreaming` both hide the greeting
  // during the first send — the greeting cleanly fades into the pending
  // message bubble without a flicker.
  const showWelcomeGreeting = !conversation?.messages?.length && !pendingUserMessage && !isStreaming

  // Menu button lives in HeaderBar's `rightAction` slot. Exposes New Chat and
  // Chat History. New Chat uses `replace` (sentinel route) so the back-stack
  // doesn't accumulate abandoned empty chats; History uses `push` so the user
  // can return to the current conversation.
  const headerMenu = (
    <ChatHeaderMenu
      onNewChat={() => router.replace('/ai-chat/new')}
      onHistory={() => router.push('/ai-chat/history')}
    />
  )

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <HeaderBar showBack title={conversation?.title ?? 'Chat'} rightAction={headerMenu} />
        {/* Skip the loading spinner on the `/chat/new` sentinel — the
            query is disabled (enabled: false), so isLoading would be
            misleading. Render the empty state directly so the user can
            start typing. */}
        {isLoading && !isNewChat && !isStreaming ? (
          <YStack flex={1} justifyContent="center" alignItems="center">
            <Spinner size="large" color="$accent9" />
          </YStack>
        ) : (
          <YStack flex={1} backgroundColor="$background">
            <AnimatePresence>
              {showWelcomeGreeting ? (
                <WelcomeGreeting key="welcome-greeting" displayName={dbUser?.displayName} />
              ) : (
                <FlatList
                  key="messages-list"
                  ref={flatListRef}
                  data={reversedMessages}
                  inverted
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <MessageBubble
                      role={item.role as 'user' | 'assistant'}
                      content={item.content}
                      feedbackRating={'feedbackRating' in item ? item.feedbackRating : undefined}
                      onFeedback={
                        item.role === 'assistant' && !('isStreaming' in item)
                          ? (rating) => handleFeedback(item.id, rating)
                          : undefined
                      }
                      isStreaming={'isStreaming' in item && item.isStreaming}
                    />
                  )}
                  contentContainerStyle={{ paddingVertical: 8 }}
                  keyboardShouldPersistTaps="handled"
                />
              )}
            </AnimatePresence>

            <AnimatePresence>
              {crisisResources && <CrisisResources key="crisis-resources" />}
            </AnimatePresence>

            {streamError && <ErrorBanner>{streamError}</ErrorBanner>}

            <MessageInput
              onSend={sendMessage}
              disabled={isStreaming}
              placeholder={isStreaming ? 'Halo is thinking...' : 'Type a message...'}
            />
          </YStack>
        )}
      </KeyboardAvoidingView>
    </>
  )
}
