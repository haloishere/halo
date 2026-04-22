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

describe('useAiChat — `/chat/new` sentinel fails loud after Phase 4', () => {
  // Phase 4 wired the Scenarios picker as the single entry point for new
  // conversations; every new chat now arrives with a concrete conversationId
  // and a user-picked topic. The lazy-create path was removed — if anything
  // still routes to `/ai-chat/new` (header menu, history, error-recovery),
  // sendMessage must fail loud rather than silently default the topic.

  it('does NOT call create when conversationId is "new"', async () => {
    const onConversationCreated = vi.fn()
    const { result } = renderHook(() => useAiChat('new', { onConversationCreated }))

    await act(async () => {
      await result.current.sendMessage('first message')
    })

    expect(mockCreateMutateAsync).not.toHaveBeenCalled()
    expect(onConversationCreated).not.toHaveBeenCalled()
  })

  it('surfaces a clear "Pick a scenario first" error via setStreamError', async () => {
    const { result } = renderHook(() => useAiChat('new'))

    await act(async () => {
      await result.current.sendMessage('Hello')
    })

    expect(mockStoreState.setStreamError).toHaveBeenCalledWith(
      expect.stringContaining('Pick a scenario first'),
    )
  })

  it('does NOT stream a message when the sentinel path is hit', async () => {
    const { result } = renderHook(() => useAiChat('new'))

    await act(async () => {
      await result.current.sendMessage('Hello')
    })

    expect(mockStreamMessage).not.toHaveBeenCalled()
  })

  it('does NOT persist any conversation id via setLastChat on sentinel path', async () => {
    const { result } = renderHook(() => useAiChat('new'))

    await act(async () => {
      await result.current.sendMessage('Hello')
    })

    expect(mockSetLastChat).not.toHaveBeenCalled()
  })
})
