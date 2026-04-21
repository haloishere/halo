import { useCallback, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useChatStore } from '../stores/chat'
import { useLastChatStore } from '../stores/last-chat'
import { streamMessage } from '../api/ai-streaming'
import { useCreateConversation } from '../api/ai-chat'
import { NEW_CHAT_SENTINEL } from '../lib/chat-resume'

/**
 * AI chat streaming hook.
 *
 * Accepts a `conversationId` that may be:
 * - a real UUID → sends the message directly
 * - `null`      → no-op (no chat loaded)
 * - `'new'`     → lazy-creates a fresh conversation via
 *                 `POST /v1/ai/conversations` BEFORE sending the
 *                 message, then notifies the caller via
 *                 `onConversationCreated` so the chat screen can
 *                 `router.replace` to the real id. This is the
 *                 architectural fix for empty-conversation sprawl:
 *                 the backend never learns about a chat the user
 *                 never typed into.
 *
 * Once lazy creation has happened once per hook instance, the real id
 * is remembered in a ref so subsequent sends from the same mounted
 * screen don't re-create. The `router.replace` happens in parallel —
 * the caller screen's `useLocalSearchParams` will eventually reflect
 * the real id, at which point this hook receives the real id as the
 * `conversationId` prop anyway.
 *
 * ## Known tradeoff: unmount-mid-create orphan
 *
 * If the user taps Back DURING the `POST /v1/ai/conversations` round
 * trip (after Send but before the create resolves), the backend has
 * already accepted the row. The stream is never attempted, so the
 * row remains in the DB with zero messages — a single orphan per
 * cancelled-mid-create. This is orders of magnitude smaller than the
 * pre-Path-B behaviour (one orphan per cold-open-after-2h regardless
 * of user intent) and is accepted as the cost of not aborting the
 * fetch. A future hardening pass could track the create's
 * AbortController and call it from the screen's unmount cleanup.
 */
export function useAiChat(
  conversationId: string | null,
  options?: {
    /**
     * Called once, synchronously, after a lazy-created conversation
     * has been assigned a real server id. The chat detail screen uses
     * this to `router.replace('/chat/{realId}')` so the URL stops
     * pointing at the sentinel.
     */
    onConversationCreated?: (realId: string) => void
  },
) {
  const queryClient = useQueryClient()
  const abortControllerRef = useRef<AbortController | null>(null)

  // Cache the real id once lazy creation has happened. Subsequent
  // sends in the same mounted session use this instead of re-creating,
  // even if `conversationId` is still `'new'` from useLocalSearchParams
  // on the very next render (before router.replace has propagated).
  const lazyCreatedIdRef = useRef<string | null>(null)

  // C1 regression lock: synchronously latched BEFORE the
  // `await createMutateAsyncRef.current(...)` below so two rapid-fire
  // `sendMessage` calls cannot both enter the create branch. Without
  // this, both calls would see `lazyCreatedIdRef.current === null`
  // before EITHER await resolves, and both would fire the create
  // mutation — minting two conversations where the second is
  // guaranteed to orphan as an empty row. That would re-introduce a
  // smaller version of the exact sprawl Path B was designed to fix.
  const lazyCreateInFlightRef = useRef(false)

  const createConversation = useCreateConversation()
  // Stable ref for `mutateAsync` so it doesn't need to sit in
  // `sendMessage`'s useCallback deps. React Query returns a new
  // mutation object on every render, so listing it in deps would
  // recreate `sendMessage` on every render and churn the
  // `MessageInput` onSend prop (unnecessary re-renders downstream).
  const createMutateAsyncRef = useRef(createConversation.mutateAsync)
  createMutateAsyncRef.current = createConversation.mutateAsync

  // Stable ref for the onConversationCreated callback so we don't have
  // to put it in sendMessage's useCallback deps. (Same pattern as
  // `createMutateAsyncRef` above — options.onConversationCreated is a
  // new reference every render if the caller passes an inline arrow.)
  const onConversationCreatedRef = useRef(options?.onConversationCreated)
  onConversationCreatedRef.current = options?.onConversationCreated

  const {
    startStreaming,
    appendChunk,
    finishStreaming,
    setStreamError,
    setCrisisResources,
    isStreaming,
  } = useChatStore()

  const sendMessage = useCallback(
    async (content: string) => {
      // Resolve the effective id. Priority: cached real id from a
      // previous lazy-create on THIS hook instance > the prop.
      let effectiveId: string | null = lazyCreatedIdRef.current ?? conversationId
      if (!effectiveId || isStreaming) return

      const needsLazyCreate = effectiveId === NEW_CHAT_SENTINEL

      // C1: in-flight latch. If another `sendMessage` is already inside
      // the create round-trip, drop this one — otherwise both would
      // fire `createConversation.mutateAsync({})` before either await
      // resolved, producing two rows in the DB.
      if (needsLazyCreate && lazyCreateInFlightRef.current) return

      // I2: show the pending message IMMEDIATELY — BEFORE any await —
      // so the user sees their typed content + a streaming indicator
      // while the create round-trip is in flight. Without this, the
      // UI appears frozen during the entire lazy-create POST.
      // `setStreamError` in the failure paths below clears
      // `pendingUserMessage` + `isStreaming` via the chat store
      // contract, cleaning up this optimistic state.
      startStreaming(content)

      if (needsLazyCreate) {
        lazyCreateInFlightRef.current = true
        try {
          // TODO(phase-4-scenario-picker): replace the hardcoded topic with the
          // value chosen on the Scenarios-tab picker once that UI lands.
          // TODO(mobile-sentry-wrapper): upgrade this warn to
          // `Sentry.captureMessage(..., 'warning')` once a mobile Sentry client
          // is wired. Until then the fallback is invisible in prod — gate is
          // `__DEV__` only, matching `apps/mobile/src/api/client.ts:42`.
          if (__DEV__) {
            console.warn(
              '[useAiChat] phase-4-scenario-picker not wired — defaulting topic to food_and_restaurants',
            )
          }
          const created = await createMutateAsyncRef.current({
            topic: 'food_and_restaurants',
          })
          lazyCreateInFlightRef.current = false
          if (!created) {
            // Belt-and-suspenders: `apiRequest` can envelope-collapse
            // to `success: true, data: undefined` in edge cases.
            setStreamError('Failed to create conversation')
            return
          }
          effectiveId = created.id
          lazyCreatedIdRef.current = created.id
          onConversationCreatedRef.current?.(created.id)
        } catch (err) {
          lazyCreateInFlightRef.current = false
          setStreamError(err instanceof Error ? err.message : 'Failed to create conversation')
          return
        }
      }

      const controller = new AbortController()
      abortControllerRef.current = controller

      try {
        await streamMessage(
          effectiveId,
          content,
          {
            onChunk: (text) => appendChunk(text),
            onDone: async () => {
              // Stop streaming indicator but keep optimistic messages visible
              useChatStore.setState({ isStreaming: false })
              // Issue #126: bump the 2h resume window immediately — before
              // any awaits — so a rejected invalidateQueries cannot prevent
              // the timestamp from being persisted. effectiveId is always a
              // real string here (guarded by the !effectiveId early return
              // above and reassigned from the lazy-create result if needed).
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              useLastChatStore.getState().setLastChat(effectiveId!, Date.now())
              // Wait for refetch to complete before clearing optimistic messages
              await queryClient.invalidateQueries({
                queryKey: ['ai', 'conversations', effectiveId],
              })
              finishStreaming()
            },
            onError: (error) => {
              setStreamError(error)
            },
            onSafetyBlock: (message) => {
              setStreamError(message)
            },
            onCrisisResources: (resources) => {
              useChatStore.getState().setCrisisResources(resources)
            },
          },
          controller.signal,
        )
      } catch (err) {
        if (!controller.signal.aborted) {
          setStreamError(err instanceof Error ? err.message : 'Failed to send message')
        }
      }
    },
    // `createConversation` / `options.onConversationCreated` are NOT in
    // the deps — they're read via stable refs above. Including them
    // would churn sendMessage's identity on every render (react-query
    // returns a new mutation object each call) and cascade re-renders
    // through MessageInput.
    [
      conversationId,
      isStreaming,
      startStreaming,
      appendChunk,
      finishStreaming,
      setStreamError,
      setCrisisResources,
      queryClient,
    ],
  )

  const cancelStream = useCallback(() => {
    abortControllerRef.current?.abort()
    finishStreaming()
  }, [finishStreaming])

  const retryLastMessage = useCallback(
    async (content: string) => {
      useChatStore.getState().resetStreamingState()
      await sendMessage(content)
    },
    [sendMessage],
  )

  return { sendMessage, cancelStream, retryLastMessage }
}
