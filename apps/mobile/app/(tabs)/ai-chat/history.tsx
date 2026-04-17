/**
 * /chat/history — past-conversations list screen.
 *
 * This screen was the (tabs)/ai-chat.tsx body pre-PR 4. PR 4 rewrote that
 * tab into a 2h-resume loader, so the conversation-list UX moved here. It
 * is reached from the chat detail header (PR 6 adds the button), not from
 * the tab bar.
 *
 * ## Path B invariant (critical)
 *
 * Both the FAB and the empty-state "New Chat" button route to the
 * `/chat/new` sentinel — they do NOT call `createConversation.mutate`.
 * Lazy creation happens downstream in `useAiChat.sendMessage` when the
 * user actually types and sends their first message. This is the same
 * architectural fix PR 4 shipped to eliminate empty-conversation sprawl.
 * A regression-lock test in `__tests__/history.test.tsx` fails loudly if
 * anyone re-introduces a mutation on these entry points.
 */
import { useCallback, useState } from 'react'
import { useNavigation, Stack } from 'expo-router'
import { useToastController } from '@tamagui/toast'
import { YStack, Button, SizableText, Theme } from 'tamagui'
import { Plus } from '@tamagui/lucide-icons'
import { AnimatedScreen, ConfirmDialog } from '../../../src/components/ui'
import { HeaderBar } from '../../../src/components/ui/HeaderBar'
import { ConversationList } from '../../../src/components/chat/ConversationList'
import { useConversationsQuery, useDeleteConversation } from '../../../src/api/ai-chat'
import { useChatStore } from '../../../src/stores/chat'
import { NEW_CHAT_SENTINEL } from '../../../src/lib/chat-resume'
import type { AiConversation } from '@halo/shared'

export default function HistoryScreen() {
  // `useNavigation` gives us access to the nested ai-chat Stack's
  // navigator so we can fully RESET the nested stack (not just replace
  // the top entry) when the user picks a chat. See `handleSelect`
  // below for why a full reset is required.
  const navigation = useNavigation()
  const { data, isLoading, isRefetching, isError, refetch, fetchNextPage, hasNextPage } =
    useConversationsQuery()
  // Destructure `mutate` + `isPending` from the mutation. React Query
  // guarantees `mutate` is reference-stable, but the containing mutation
  // object is a new reference on every render — putting it in a
  // useCallback dep list would silently defeat memoization and recreate
  // the handler on every render. See PR #123 review thread.
  const { mutate: deleteConversationMutate, isPending: isDeletePending } = useDeleteConversation()
  const toastCtrl = useToastController()
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const conversations: AiConversation[] = data?.pages.flatMap((page) => page.conversations) ?? []

  const handleSelect = useCallback(
    (id: string) => {
      // FULL nested-stack reset — not a push or a replace. Replace alone
      // would leave `[prevChat, newChat]` on the stack, so hardware back
      // from the new chat pops back to the previous chat. The user
      // explicitly wants: "back from a chat I picked in history should
      // leave the chat tab entirely and return to whichever tab I came
      // from (home)". `navigation.reset` with a single route achieves
      // that — the nested stack becomes `[newChat]`, and hardware back
      // on an empty nested stack hands off to the Tabs navigator, which
      // takes the user to the previously-focused tab.
      //
      // `as never` cast on the route object: expo-router does not
      // auto-generate the navigator-route union for `useNavigation`'s
      // default `NavigationProp` type, so `name` narrows to `never`.
      // The runtime shape is exactly what React Navigation expects;
      // the cast is purely a TypeScript limitation workaround.
      navigation.reset({
        index: 0,
        routes: [{ name: '[id]', params: { id } } as never],
      })
    },
    [navigation],
  )

  const handleDelete = useCallback((id: string) => {
    setPendingDeleteId(id)
  }, [])

  // Defined before handleConfirmDelete so the latter can reference it
  // in both its body and its useCallback dep list without a TDZ error.
  const handleCreateNew = useCallback(() => {
    // Same full-stack-reset semantics as `handleSelect` — tapping
    // "new chat" from history should leave the user in a fresh chat
    // with hardware back returning straight to the previous tab
    // (home), not bouncing through the previous chat or history.
    navigation.reset({
      index: 0,
      routes: [{ name: '[id]', params: { id: NEW_CHAT_SENTINEL } } as never],
    })
  }, [navigation])

  const handleConfirmDelete = useCallback(() => {
    if (!pendingDeleteId) return
    // Capture before the async mutation so the closure is stable even if
    // setPendingDeleteId(null) re-renders before onSuccess fires.
    const deletedId = pendingDeleteId
    deleteConversationMutate(deletedId, {
      onSuccess: () => {
        toastCtrl.show('Chat deleted')
        setPendingDeleteId(null)
        // If the deleted conversation was the one currently open behind us
        // in the stack (user arrived here via the chat-screen header button),
        // reset the nested stack to a fresh new chat immediately.
        // This is deterministic — no waiting for a background 404 refetch.
        // Without this, pressing back returns the user to a broken screen
        // that still renders the old messages and fails to send.
        if (deletedId === useChatStore.getState().activeConversationId) {
          handleCreateNew()
        }
      },
      onError: (err) => {
        // Match the community module's pattern: surface the server-provided
        // message when available, fall back to a generic string otherwise.
        toastCtrl.show(err.message ?? 'Failed to delete chat. Please try again.')
        setPendingDeleteId(null)
      },
    })
  }, [pendingDeleteId, deleteConversationMutate, toastCtrl, handleCreateNew])

  // Error state — match the (tabs)/ai-chat.tsx loader error UI for
  // consistency. Without this, a failed query (network, 401, 500) would
  // silently collapse to the ConversationList empty state and caregivers
  // would think their chat history was wiped.
  if (isError) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <AnimatedScreen>
          <HeaderBar showBack title="Chat History" />
          <YStack flex={1} alignItems="center" justifyContent="center" gap="$4" padding="$4">
            <SizableText size="$6" textAlign="center">
              Something went wrong
            </SizableText>
            <SizableText size="$3" color="$color10" textAlign="center">
              We couldn&apos;t load your chats. Check your connection and try again.
            </SizableText>
            <Theme name="accent">
              <Button onPress={() => refetch()} accessibilityLabel="Try again">
                Try again
              </Button>
            </Theme>
          </YStack>
        </AnimatedScreen>
      </>
    )
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <AnimatedScreen>
        <HeaderBar showBack title="Chat History" />
        <YStack flex={1} backgroundColor="$background">
          <ConversationList
            conversations={conversations}
            isLoading={isLoading}
            isRefreshing={isRefetching}
            onRefresh={refetch}
            onSelect={handleSelect}
            onDelete={handleDelete}
            onCreateNew={handleCreateNew}
            onLoadMore={() => fetchNextPage()}
            hasMore={hasNextPage}
          />
          {conversations.length > 0 && (
            <Theme name="accent">
              <Button
                position="absolute"
                bottom="$4"
                right="$4"
                size="$5"
                circular
                backgroundColor="$color8"
                onPress={handleCreateNew}
                accessibilityLabel="New chat"
              >
                <Plus size={24} color="$color1" />
              </Button>
            </Theme>
          )}
        </YStack>

        <ConfirmDialog
          open={pendingDeleteId !== null}
          onOpenChange={(open) => {
            if (!open) setPendingDeleteId(null)
          }}
          title="Delete Chat"
          description="Are you sure you want to delete this conversation?"
          confirmLabel="Delete"
          variant="destructive"
          loading={isDeletePending}
          onConfirm={handleConfirmDelete}
        />
      </AnimatedScreen>
    </>
  )
}
