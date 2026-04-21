import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react-native'
import { useAiChat } from '../useAiChat'

const mockStreamMessage = vi.fn()
vi.mock('../../api/ai-streaming', () => ({
  streamMessage: (...args: unknown[]) => mockStreamMessage(...args),
}))

const mockInvalidateQueries = vi.fn().mockResolvedValue(undefined)
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
  }),
}))

// Mock `useCreateConversation` — the hook that POSTs /v1/ai/conversations
// for the lazy-create path. Tests prime `mockCreateMutateAsync` per scenario
// to return either a real conversation or simulate a failure.
const mockCreateMutateAsync = vi.fn()
vi.mock('../../api/ai-chat', () => ({
  useCreateConversation: () => ({
    mutateAsync: mockCreateMutateAsync,
    mutate: vi.fn(),
    isPending: false,
  }),
}))

// Mock useLastChatStore — the persisted store whose setLastChat must be called
// after each successful stream so the 2h resume window is anchored to the
// most recent message, not just when the screen was mounted (issue #126).
// Mocked as a function (matching the real Zustand hook shape) so callers
// that use it as a selector hook won't throw.
const mockSetLastChat = vi.fn()
vi.mock('../../stores/last-chat', () => ({
  useLastChatStore: Object.assign(vi.fn(), {
    getState: () => ({
      setLastChat: mockSetLastChat,
    }),
  }),
}))

// Mock the Zustand store
const mockStoreState = {
  isStreaming: false,
  startStreaming: vi.fn(),
  appendChunk: vi.fn(),
  finishStreaming: vi.fn(),
  setStreamError: vi.fn(),
  setCrisisResources: vi.fn(),
}

vi.mock('../../stores/chat', () => ({
  useChatStore: Object.assign(
    (selector?: (state: typeof mockStoreState) => unknown) =>
      selector ? selector(mockStoreState) : mockStoreState,
    {
      setState: vi.fn(),
      getState: () => ({
        ...mockStoreState,
        resetStreamingState: vi.fn(),
        setCrisisResources: mockStoreState.setCrisisResources,
      }),
    },
  ),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockStoreState.isStreaming = false
  mockStreamMessage.mockResolvedValue(undefined)
  // Spy on console.warn so the Phase-4 fallback guard is observable without
  // polluting test output. Tests that hit the lazy-create path can assert
  // on (console.warn as vi.Mock).
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  // Default create-mutation implementation returns a valid new conversation.
  // Tests that need failure scenarios override this per-test.
  mockCreateMutateAsync.mockResolvedValue({
    id: 'lazy-created-id',
    userId: 'user-1',
    title: null,
    summary: null,
    topic: 'food_and_restaurants',
    createdAt: '2026-05-15T12:00:00.000Z',
    updatedAt: '2026-05-15T12:00:00.000Z',
  })
})

describe('useAiChat', () => {
  it('sendMessage calls startStreaming then streamMessage', async () => {
    const { result } = renderHook(() => useAiChat('conv-1'))

    await act(async () => {
      await result.current.sendMessage('Hello')
    })

    expect(mockStoreState.startStreaming).toHaveBeenCalledWith('Hello')
    expect(mockStreamMessage).toHaveBeenCalledWith(
      'conv-1',
      'Hello',
      expect.objectContaining({
        onChunk: expect.any(Function),
        onDone: expect.any(Function),
        onError: expect.any(Function),
      }),
      expect.any(Object), // AbortSignal
    )
  })

  it('sendMessage is no-op when isStreaming is true', async () => {
    mockStoreState.isStreaming = true
    const { result } = renderHook(() => useAiChat('conv-1'))

    await act(async () => {
      await result.current.sendMessage('Hello')
    })

    expect(mockStoreState.startStreaming).not.toHaveBeenCalled()
    expect(mockStreamMessage).not.toHaveBeenCalled()
  })

  it('sendMessage is no-op when conversationId is null', async () => {
    const { result } = renderHook(() => useAiChat(null))

    await act(async () => {
      await result.current.sendMessage('Hello')
    })

    expect(mockStoreState.startStreaming).not.toHaveBeenCalled()
    expect(mockStreamMessage).not.toHaveBeenCalled()
  })

  it('cancelStream aborts and calls finishStreaming', () => {
    const { result } = renderHook(() => useAiChat('conv-1'))

    act(() => {
      result.current.cancelStream()
    })

    expect(mockStoreState.finishStreaming).toHaveBeenCalled()
  })

  it('error in streamMessage calls setStreamError when not aborted', async () => {
    mockStreamMessage.mockRejectedValueOnce(new Error('Stream failed'))
    const { result } = renderHook(() => useAiChat('conv-1'))

    await act(async () => {
      await result.current.sendMessage('Hello')
    })

    expect(mockStoreState.setStreamError).toHaveBeenCalledWith('Stream failed')
  })

  it('calls setLastChat with the conversation id and a current timestamp when onDone fires', async () => {
    // Issue #126: setLastChat must be bumped on each successful send so the
    // 2h resume window reflects the most recent message, not the mount time.
    mockStreamMessage.mockImplementationOnce(
      async (
        _id: unknown,
        _content: unknown,
        callbacks: { onDone: () => Promise<void> },
        _signal: unknown,
      ) => {
        await callbacks.onDone()
      },
    )

    const before = Date.now()
    const { result } = renderHook(() => useAiChat('conv-1'))

    await act(async () => {
      await result.current.sendMessage('Hello')
    })

    expect(mockSetLastChat).toHaveBeenCalledTimes(1)
    const [calledId, calledTs] = mockSetLastChat.mock.calls[0] as [string, number]
    expect(calledId).toBe('conv-1')
    expect(calledTs).toBeGreaterThanOrEqual(before)
    expect(calledTs).toBeLessThanOrEqual(Date.now())
  })

  it('does NOT call setLastChat when the stream errors', async () => {
    mockStreamMessage.mockRejectedValueOnce(new Error('Stream failed'))
    const { result } = renderHook(() => useAiChat('conv-1'))

    await act(async () => {
      await result.current.sendMessage('Hello')
    })

    expect(mockSetLastChat).not.toHaveBeenCalled()
  })
})

describe('useAiChat — lazy conversation creation (`/chat/new` sentinel)', () => {
  it('creates a conversation before sending when conversationId is "new"', async () => {
    const onConversationCreated = vi.fn()
    const { result } = renderHook(() => useAiChat('new', { onConversationCreated }))

    await act(async () => {
      await result.current.sendMessage('first message')
    })

    // Legacy lazy-create fallback (NEW_CHAT_SENTINEL path). Picker-first
    // flows skip this branch — Phase 4 wired the picker, so this fallback
    // only fires when something bypasses it. Defaults to `food_and_restaurants`
    // as defense-in-depth until the sentinel path is retired.
    expect(mockCreateMutateAsync).toHaveBeenCalledTimes(1)
    expect(mockCreateMutateAsync).toHaveBeenCalledWith({ topic: 'food_and_restaurants' })

    // The caller is notified synchronously with the real id so it can
    // router.replace the URL to stop pointing at the sentinel.
    expect(onConversationCreated).toHaveBeenCalledWith('lazy-created-id')

    // Then the message is streamed against the real id, NOT the sentinel.
    expect(mockStreamMessage).toHaveBeenCalledWith(
      'lazy-created-id',
      'first message',
      expect.any(Object),
      expect.any(Object),
    )
  })

  it('reuses the cached lazy-created id on subsequent sends without re-creating', async () => {
    const onConversationCreated = vi.fn()
    const { result } = renderHook(() => useAiChat('new', { onConversationCreated }))

    // First send: lazy-creates, streams to real id.
    await act(async () => {
      await result.current.sendMessage('first')
    })
    // Second send: conversationId prop is still 'new' (useLocalSearchParams
    // may not have propagated the router.replace yet). The hook must
    // reuse the cached real id from its ref — NOT call the create
    // mutation a second time.
    await act(async () => {
      await result.current.sendMessage('second')
    })

    expect(mockCreateMutateAsync).toHaveBeenCalledTimes(1)
    expect(onConversationCreated).toHaveBeenCalledTimes(1)
    expect(mockStreamMessage).toHaveBeenCalledTimes(2)
    expect(mockStreamMessage).toHaveBeenNthCalledWith(
      1,
      'lazy-created-id',
      'first',
      expect.any(Object),
      expect.any(Object),
    )
    expect(mockStreamMessage).toHaveBeenNthCalledWith(
      2,
      'lazy-created-id',
      'second',
      expect.any(Object),
      expect.any(Object),
    )
  })

  it('shows the pending message during the create round-trip and surfaces an error when the create mutation fails', async () => {
    mockCreateMutateAsync.mockRejectedValueOnce(new Error('Backend 500'))
    const onConversationCreated = vi.fn()
    const { result } = renderHook(() => useAiChat('new', { onConversationCreated }))

    await act(async () => {
      await result.current.sendMessage('first message')
    })

    // Per the I2 UX fix: `startStreaming` must fire BEFORE the create
    // mutation so the user sees their typed message + a spinner during
    // the POST round-trip (otherwise the UI looks frozen). On failure,
    // `setStreamError` cleans up the pending state via the chat store's
    // contract (clears `pendingUserMessage` + `isStreaming` + sets
    // `streamError`).
    expect(mockStoreState.startStreaming).toHaveBeenCalledWith('first message')
    expect(mockStoreState.setStreamError).toHaveBeenCalledWith('Backend 500')
    expect(onConversationCreated).not.toHaveBeenCalled()
    expect(mockStreamMessage).not.toHaveBeenCalled()
  })

  it('shows the pending message and surfaces an error when the create mutation returns falsy data', async () => {
    // The apiRequest envelope can collapse to `success: true, data: undefined`
    // in edge cases — defend against it.
    mockCreateMutateAsync.mockResolvedValueOnce(undefined)
    const onConversationCreated = vi.fn()
    const { result } = renderHook(() => useAiChat('new', { onConversationCreated }))

    await act(async () => {
      await result.current.sendMessage('first message')
    })

    expect(mockStoreState.startStreaming).toHaveBeenCalledWith('first message')
    expect(mockStoreState.setStreamError).toHaveBeenCalledWith('Failed to create conversation')
    expect(onConversationCreated).not.toHaveBeenCalled()
    expect(mockStreamMessage).not.toHaveBeenCalled()
  })

  it('fires the create mutation exactly once when two sendMessage calls race (C1 regression lock)', async () => {
    // Regression lock for the double-send race caught in round-4 review:
    // if the user hits Send twice in rapid succession (or React fires the
    // submit handler twice in StrictMode), both calls enter `sendMessage`
    // before the first create mutation has resolved. Without an in-flight
    // latch set BEFORE the await, both calls see `lazyCreatedIdRef === null`
    // and fire create twice — producing two conversations, one of which
    // ends up orphaned (empty). That's the exact empty-conversation
    // sprawl Path B was supposed to eliminate.
    //
    // The fix is a dedicated in-flight ref set synchronously at the top
    // of the sentinel branch, before the `await mutateAsync`.
    let resolveCreate: ((conv: unknown) => void) | null = null
    mockCreateMutateAsync.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve
        }),
    )

    const { result } = renderHook(() => useAiChat('new'))

    // Fire two sends in the same synchronous tick BEFORE the create
    // resolves. Neither await completes yet because the mock hasn't
    // resolved.
    await act(async () => {
      const send1 = result.current.sendMessage('first')
      const send2 = result.current.sendMessage('second')
      // Now let the create resolve so both awaits can progress.
      resolveCreate?.({
        id: 'lazy-created-id',
        userId: 'user-1',
        title: null,
        summary: null,
        createdAt: '2026-05-15T12:00:00.000Z',
        updatedAt: '2026-05-15T12:00:00.000Z',
      })
      await Promise.all([send1, send2])
    })

    // C1 invariant: exactly ONE create, even under a double-send race.
    expect(mockCreateMutateAsync).toHaveBeenCalledTimes(1)
  })

  it('calls setLastChat with the lazy-created id (not the sentinel "new") on successful stream', async () => {
    // Issue #126: the real id — resolved from the lazy-create branch — must
    // be persisted, not the 'new' sentinel, so the Chat tab can resume the
    // correct conversation on re-entry.
    mockStreamMessage.mockImplementationOnce(
      async (
        _id: unknown,
        _content: unknown,
        callbacks: { onDone: () => Promise<void> },
        _signal: unknown,
      ) => {
        await callbacks.onDone()
      },
    )

    const { result } = renderHook(() => useAiChat('new'))

    await act(async () => {
      await result.current.sendMessage('Hello')
    })

    expect(mockSetLastChat).toHaveBeenCalledWith('lazy-created-id', expect.any(Number))
  })

  it('persists lazyCreatedIdRef across prop changes from "new" to the real id (N5 regression lock)', async () => {
    // Regression lock for ref persistence: after the loader routes to
    // /chat/new, the user sends a first message, `onConversationCreated`
    // fires, and the chat screen calls router.replace('/chat/{realId}').
    // That re-renders the screen with `id: realId`, which means
    // `useAiChat(realId)` is called with a different prop. React reuses
    // the hook INSTANCE across renders of the same component, so
    // `lazyCreatedIdRef.current` persists — but this test locks it in
    // against a refactor that might accidentally reset the ref.
    const onConversationCreated = vi.fn()
    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => useAiChat(id, { onConversationCreated }),
      { initialProps: { id: 'new' } },
    )

    // First send: lazy-creates with id 'new'.
    await act(async () => {
      await result.current.sendMessage('first')
    })
    expect(mockCreateMutateAsync).toHaveBeenCalledTimes(1)

    // Simulate router.replace by re-rendering with the real id.
    rerender({ id: 'lazy-created-id' })

    // Second send after the re-render: uses the real id prop. Must NOT
    // fire create again (the backend row already exists).
    await act(async () => {
      await result.current.sendMessage('second')
    })
    expect(mockCreateMutateAsync).toHaveBeenCalledTimes(1)
    expect(mockStreamMessage).toHaveBeenCalledTimes(2)
    // Both sends target the same real id, not the sentinel.
    expect(mockStreamMessage).toHaveBeenNthCalledWith(
      1,
      'lazy-created-id',
      'first',
      expect.any(Object),
      expect.any(Object),
    )
    expect(mockStreamMessage).toHaveBeenNthCalledWith(
      2,
      'lazy-created-id',
      'second',
      expect.any(Object),
      expect.any(Object),
    )
  })
})
