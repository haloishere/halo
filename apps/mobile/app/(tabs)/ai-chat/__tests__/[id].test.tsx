/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '../../../../src/test/render'
import { NEW_CHAT_SENTINEL } from '../../../../src/lib/chat-resume'

// Cold-start RNTL + Tamagui hydration takes ~20s on the first render of this
// file. Same ceiling as the (tabs)/ai-chat loader test suite.
vi.setConfig({ testTimeout: 60_000 })

// ─── Hoisted mocks ─────────────────────────────────────────────────────────
// The test mutates `paramsId.current` and rerenders to simulate
// `router.setParams({ id: realId })` which, in the real app, is called by
// `onConversationCreated` in `useAiChat` after lazy conversation creation.
//
// `queryClientMock` is hoisted and cached so `useQueryClient()` returns a
// STABLE reference across renders — matches production where the singleton
// QueryClient from _layout.tsx is the same object every call. Without this,
// the real chat/[id] Effect 2 (which has `queryClient` in its deps) would
// see a new object on every rerender and falsely re-fire its cleanup.
//
// NOTE: `vi.hoisted` runs before imports, so we can't reference
// `NEW_CHAT_SENTINEL` here. Hardcode the sentinel value — an integration test
// in chat-resume.test.ts locks the constant at `'new'`.
const {
  paramsId,
  invalidateQueriesSpy,
  queryClientMock,
  conversationDataRef,
  conversationIsErrorRef,
  setLastChatSpy,
  clearLastChatSpy,
} = vi.hoisted(() => {
  const invalidateQueriesSpy = vi.fn()
  return {
    paramsId: { current: 'new' as string },
    invalidateQueriesSpy,
    queryClientMock: { invalidateQueries: invalidateQueriesSpy },
    // Mutable ref so individual tests can prime the conversation's
    // `messages` array (empty → greeting renders, non-empty → greeting
    // hides). The useConversationQuery mock below reads this on every
    // call so state changes propagate cleanly.
    conversationDataRef: {
      current: { id: 'chat-id', title: 'Test', messages: [] as unknown[] },
    },
    // Mutable flag so individual tests can simulate a conversation
    // query error (e.g. 404 when the row was deleted on another
    // device) and assert the screen calls `clearLastChat`.
    conversationIsErrorRef: { current: false },
    setLastChatSpy: vi.fn(),
    clearLastChatSpy: vi.fn(),
  }
})

// ─── Module mocks ──────────────────────────────────────────────────────────

const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn(), setParams: vi.fn() }

vi.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: paramsId.current }),
  useRouter: () => router,
  Stack: { Screen: () => null },
}))

// Shared `cancelStream` spy — this is the assertion target. The bug is that
// the chat/[id] useEffect cleanup fires cancelStream on conversationId change,
// which kills the in-flight stream mid-send after lazy conversation creation.
const cancelStreamSpy = vi.fn()
const sendMessageSpy = vi.fn()

vi.mock('../../../../src/hooks/useAiChat', () => ({
  useAiChat: () => ({
    sendMessage: sendMessageSpy,
    cancelStream: cancelStreamSpy,
    retryLastMessage: vi.fn(),
  }),
}))

vi.mock('../../../../src/api/ai-chat', () => ({
  useConversationQuery: (id: string | null) => ({
    data: id && !conversationIsErrorRef.current ? conversationDataRef.current : undefined,
    isLoading: false,
    isError: conversationIsErrorRef.current,
  }),
  useSubmitFeedback: () => ({ mutate: vi.fn() }),
}))

// Mock the persisted last-chat store. The screen writes to it on mount
// for real conversation ids and clears it on 404. Tests assert on the
// spies directly rather than rendering the store's actual persisted
// state.
vi.mock('../../../../src/stores/last-chat', () => ({
  useLastChatStore: Object.assign(
    (selector: (s: unknown) => unknown) =>
      selector({
        lastChatId: null,
        lastChatUpdatedAt: null,
        setLastChat: setLastChatSpy,
        clearLastChat: clearLastChatSpy,
      }),
    {
      getState: () => ({
        lastChatId: null,
        lastChatUpdatedAt: null,
        setLastChat: setLastChatSpy,
        clearLastChat: clearLastChatSpy,
      }),
      setState: vi.fn(),
    },
  ),
}))

// Minimal chat store mock — provides stable action references and a
// deterministic initial state. Individual tests mutate `pendingUserMessage`
// / `isStreaming` to drive the welcome-greeting visibility rules.
const chatStoreState = {
  pendingUserMessage: null as string | null,
  streamingMessage: '',
  isStreaming: false,
  streamError: null,
  crisisResources: null,
  setActiveConversation: vi.fn(),
  startStreaming: vi.fn(),
  appendChunk: vi.fn(),
  finishStreaming: vi.fn(),
  setStreamError: vi.fn(),
  setCrisisResources: vi.fn(),
  resetStreamingState: vi.fn(),
}

vi.mock('../../../../src/stores/chat', () => ({
  useChatStore: Object.assign(
    (selector?: (s: typeof chatStoreState) => unknown) =>
      selector ? selector(chatStoreState) : chatStoreState,
    {
      getState: () => chatStoreState,
      setState: vi.fn(),
    },
  ),
}))

// React Query client mock — returns the hoisted stable reference so Effect 2
// in chat/[id].tsx sees a stable `queryClient` dep and doesn't re-fire on
// rerender. `invalidateQueriesSpy` + `queryClientMock` are defined above in
// the `vi.hoisted` block.
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => queryClientMock,
}))

// Prop-capturing stubs. The existing sentinel→real regression tests only
// need these to render as no-ops. The new PR 6 tests need to read the
// `rightAction` prop on HeaderBar (to assert the history button is wired)
// and check whether WelcomeGreeting was rendered with the expected
// displayName (from auth store).
const headerBarProps: { current: Record<string, unknown> | null } = { current: null }
const welcomeGreetingProps: { current: Record<string, unknown> | null } = { current: null }

vi.mock('../../../../src/components/ui/HeaderBar', () => ({
  HeaderBar: (props: Record<string, unknown>) => {
    headerBarProps.current = props
    return null
  },
}))
vi.mock('../../../../src/components/chat/WelcomeGreeting', () => ({
  WelcomeGreeting: (props: Record<string, unknown>) => {
    welcomeGreetingProps.current = props
    return null
  },
}))
vi.mock('../../../../src/components/chat/MessageBubble', () => ({
  MessageBubble: () => null,
}))
vi.mock('../../../../src/components/chat/MessageInput', () => ({
  MessageInput: () => null,
}))
vi.mock('../../../../src/components/chat/CrisisResources', () => ({
  CrisisResources: () => null,
}))

// Auth store mock. PR 6 threads `dbUser.displayName` into WelcomeGreeting.
const authStoreState = {
  user: null,
  dbUser: { id: 'u1', displayName: 'Amir Jalali' } as {
    id: string
    displayName: string | null
  } | null,
  isLoading: false,
  syncError: null,
}
vi.mock('../../../../src/stores/auth', () => ({
  useAuthStore: Object.assign(
    (selector?: (s: typeof authStoreState) => unknown) =>
      selector ? selector(authStoreState) : authStoreState,
    {
      getState: () => authStoreState,
      setState: vi.fn(),
    },
  ),
}))

// Static import after mocks are hoisted.
import ChatScreen from '../[id]'

// ─── Setup / teardown ──────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  paramsId.current = NEW_CHAT_SENTINEL
  headerBarProps.current = null
  welcomeGreetingProps.current = null
  // Reset conversation data and chat/auth store state to defaults so
  // tests starting from a clean slate don't leak from prior mutations.
  conversationDataRef.current = { id: 'chat-id', title: 'Test', messages: [] }
  conversationIsErrorRef.current = false
  chatStoreState.pendingUserMessage = null
  chatStoreState.isStreaming = false
  authStoreState.dbUser = { id: 'u1', displayName: 'Amir Jalali' }
})

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('ChatScreen — sentinel → real id transition (stream-abort regression lock)', () => {
  it('does NOT call cancelStream when conversationId changes from /chat/new to a real id', () => {
    // Regression lock for the "first message silently dropped" bug:
    //
    //   1. User on /chat/new types and hits Send.
    //   2. `useAiChat.sendMessage` awaits the lazy create → gets realId.
    //   3. `onConversationCreated(realId)` fires `router.setParams({ id: realId })`.
    //      (Previously `router.replace` — see comment in [id].tsx for why that
    //      caused an unmount which triggered the cleanup and killed the stream.)
    //   4. Synchronously: sendMessage creates AbortController, assigns it to
    //      `abortControllerRef.current`, calls `streamMessage(..., signal)`.
    //      streamMessage registers `signal.addEventListener('abort', xhr.abort)`
    //      and dispatches the XHR before returning its Promise.
    //   5. sendMessage's `await` yields → React re-renders [id].tsx with
    //      the new conversationId param (no unmount — setParams is in-place).
    //   6. Old code (router.replace): caused unmount → cleanup fired →
    //      cancelStream() → signal.abort() → xhr.abort() → stream dead.
    //   7. New code (router.setParams): re-render only → cleanup never fires
    //      → stream survives.

    paramsId.current = NEW_CHAT_SENTINEL
    const { rerender } = render(<ChatScreen />)

    // Baseline: cancelStream not called on initial mount.
    expect(cancelStreamSpy).not.toHaveBeenCalled()

    // Simulate `router.replace('/chat/realId')` by updating the mocked
    // useLocalSearchParams return value and rerendering.
    paramsId.current = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    rerender(<ChatScreen />)

    // CRITICAL: cancelStream must NOT fire during the sentinel→real id
    // transition. Firing it would abort the in-flight stream (via
    // abortControllerRef.current.abort() → signal → xhr.abort()) and the
    // user's first message would be silently dropped from the UI.
    expect(cancelStreamSpy).not.toHaveBeenCalled()
  })

  it('fires the full cleanup contract exactly once when the component unmounts', () => {
    // Sanity check: the split effect must still fire the full cleanup on
    // unmount (user navigates back to the tab) — otherwise an in-flight
    // stream would leak past the screen lifetime and the conversation list
    // would not pick up auto-generated titles until the next manual refresh.

    paramsId.current = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    const { unmount } = render(<ChatScreen />)

    expect(cancelStreamSpy).not.toHaveBeenCalled()
    expect(invalidateQueriesSpy).not.toHaveBeenCalled()

    unmount()

    expect(cancelStreamSpy).toHaveBeenCalledTimes(1)
    // Full cleanup contract: abort + clear active conversation + invalidate list.
    expect(chatStoreState.setActiveConversation).toHaveBeenCalledWith(null)
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['ai', 'conversations'] })
  })
})

describe('ChatScreen — welcome greeting (PR 6)', () => {
  it('renders WelcomeGreeting when conversation has zero messages, no pending, not streaming', () => {
    paramsId.current = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    conversationDataRef.current = { id: 'chat-id', title: 'Test', messages: [] }
    chatStoreState.pendingUserMessage = null
    chatStoreState.isStreaming = false

    render(<ChatScreen />)

    expect(welcomeGreetingProps.current).not.toBeNull()
    // Greeting must thread the caregiver's displayName through from the
    // auth store. Falling back to "there" is handled inside
    // `buildGreeting`, locked by chat-greeting.test.ts.
    expect(welcomeGreetingProps.current?.displayName).toBe('Amir Jalali')
  })

  it('passes a nullish displayName when dbUser is null (pre-sync state)', () => {
    paramsId.current = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    conversationDataRef.current = { id: 'chat-id', title: 'Test', messages: [] }
    authStoreState.dbUser = null

    render(<ChatScreen />)

    expect(welcomeGreetingProps.current).not.toBeNull()
    // The screen forwards `dbUser?.displayName` — optional chaining
    // yields `undefined` when dbUser is null. Both null and undefined
    // are valid "no-name" inputs to `buildGreeting` (falls back to
    // "there"), so we accept either here and let chat-greeting.test.ts
    // lock the string fallback behavior.
    expect(welcomeGreetingProps.current?.displayName ?? null).toBeNull()
  })

  it('hides WelcomeGreeting when the conversation has at least one message', () => {
    paramsId.current = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    conversationDataRef.current = {
      id: 'chat-id',
      title: 'Test',
      messages: [{ id: 'm1', role: 'user', content: 'hello' }],
    }

    render(<ChatScreen />)

    expect(welcomeGreetingProps.current).toBeNull()
  })

  it('hides WelcomeGreeting when a pendingUserMessage is visible (first send in flight)', () => {
    paramsId.current = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    conversationDataRef.current = { id: 'chat-id', title: 'Test', messages: [] }
    chatStoreState.pendingUserMessage = 'hello'

    render(<ChatScreen />)

    expect(welcomeGreetingProps.current).toBeNull()
  })

  it('hides WelcomeGreeting while a stream is in flight', () => {
    paramsId.current = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    conversationDataRef.current = { id: 'chat-id', title: 'Test', messages: [] }
    chatStoreState.isStreaming = true

    render(<ChatScreen />)

    expect(welcomeGreetingProps.current).toBeNull()
  })

  it('renders WelcomeGreeting on the /chat/new sentinel (no conversation row yet)', () => {
    // Path B path: when user lands on /chat/new, the conversation query
    // is disabled and the screen has no `conversation.messages`. The
    // greeting should still render because pendingUserMessage is null
    // and isStreaming is false.
    paramsId.current = NEW_CHAT_SENTINEL
    chatStoreState.pendingUserMessage = null
    chatStoreState.isStreaming = false

    render(<ChatScreen />)

    expect(welcomeGreetingProps.current).not.toBeNull()
    expect(welcomeGreetingProps.current?.displayName).toBe('Amir Jalali')
  })
})

describe('ChatScreen — header menu', () => {
  it('passes a ChatHeaderMenu rightAction whose onNewChat replaces to /ai-chat/new and onHistory pushes /ai-chat/history', () => {
    paramsId.current = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    conversationDataRef.current = {
      id: 'chat-id',
      title: 'Test',
      messages: [{ id: 'm1', role: 'user', content: 'hi' }],
    }

    render(<ChatScreen />)

    expect(headerBarProps.current).not.toBeNull()
    expect(headerBarProps.current?.showBack).toBe(true)
    const rightAction = headerBarProps.current?.rightAction as React.ReactElement<{
      onNewChat?: () => void
      onHistory?: () => void
    }>
    expect(rightAction).toBeTruthy()

    rightAction.props.onNewChat?.()
    expect(router.replace).toHaveBeenCalledWith('/ai-chat/new')

    rightAction.props.onHistory?.()
    expect(router.push).toHaveBeenCalledWith('/ai-chat/history')
  })
})

describe('ChatScreen — last-chat persistence (Redirect tab source of truth)', () => {
  it('calls setLastChat with the real id + a current timestamp when the screen mounts for a real conversation', () => {
    // The Chat tab `<Redirect>` reads from useLastChatStore to decide
    // where to send the user on focus. The chat detail screen must
    // keep that store up to date whenever it focuses for a real id —
    // otherwise the tab would route the user to a stale chat (or to
    // /chat/new if there's no persisted id at all).
    paramsId.current = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    conversationDataRef.current = { id: 'chat-id', title: 'Test', messages: [] }

    render(<ChatScreen />)

    expect(setLastChatSpy).toHaveBeenCalledTimes(1)
    const [id, ts] = setLastChatSpy.mock.calls[0] as [string, number]
    expect(id).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
    expect(typeof ts).toBe('number')
    expect(ts).toBeGreaterThan(0)
  })

  it('does NOT call setLastChat on the /chat/new sentinel (no row to resume to yet)', () => {
    paramsId.current = NEW_CHAT_SENTINEL

    render(<ChatScreen />)

    expect(setLastChatSpy).not.toHaveBeenCalled()
  })

  it('calls clearLastChat AND navigates to /new when the conversation query returns an error (e.g. 404)', () => {
    // Scenario: user deletes the chat from the history screen (or it was
    // deleted on another device). The still-mounted chat/[id] screen sees
    // its query transition to error. The screen must:
    //   1. Clear the persisted last-chat pointer (so the Chat tab won't
    //      redirect back to the dead id on the next focus).
    //   2. Navigate to /chat/new via setParams (in-place, no unmount) so
    //      the user lands on a fresh empty chat when they press back from
    //      history — rather than staying on a broken screen that always
    //      returns "conversation not found" on send.
    paramsId.current = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    conversationIsErrorRef.current = true

    render(<ChatScreen />)

    expect(clearLastChatSpy).toHaveBeenCalledTimes(1)
    expect(router.setParams).toHaveBeenCalledWith({ id: NEW_CHAT_SENTINEL })
  })

  it('does NOT call clearLastChat or setParams on the /chat/new sentinel even if the mock flags isError', () => {
    // Defensive: isError only matters for real ids — the sentinel has
    // no query running, so an error signal on the sentinel route would
    // be spurious. Neither clearLastChat nor setParams should fire.
    paramsId.current = NEW_CHAT_SENTINEL
    conversationIsErrorRef.current = true

    render(<ChatScreen />)

    expect(clearLastChatSpy).not.toHaveBeenCalled()
    expect(router.setParams).not.toHaveBeenCalled()
  })
})
