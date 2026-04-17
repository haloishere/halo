import { describe, it, expect, beforeEach } from 'vitest'
import { useChatStore } from '../chat'

beforeEach(() => {
  // Full replace-mode reset to the declared initial state. The `true` second
  // argument tells zustand to REPLACE the entire state object (not merge), so
  // any new `ChatState` field added to `chat.ts` is picked up automatically —
  // no hand-maintained reset list to drift out of sync.
  useChatStore.setState(useChatStore.getInitialState(), true)
})

describe('useChatStore', () => {
  it('starts with idle state', () => {
    const state = useChatStore.getState()

    expect(state.activeConversationId).toBeNull()
    expect(state.streamingMessage).toBe('')
    expect(state.isStreaming).toBe(false)
    expect(state.streamError).toBeNull()
  })

  it('sets active conversation and clears streaming state', () => {
    useChatStore.getState().setStreamError('old error')
    useChatStore.getState().setActiveConversation('conv-1')

    const state = useChatStore.getState()
    expect(state.activeConversationId).toBe('conv-1')
    expect(state.streamError).toBeNull()
    expect(state.streamingMessage).toBe('')
  })

  it('starts streaming → clears error and message', () => {
    useChatStore.getState().setStreamError('old error')
    useChatStore.getState().startStreaming('test message')

    const state = useChatStore.getState()
    expect(state.isStreaming).toBe(true)
    expect(state.streamingMessage).toBe('')
    expect(state.streamError).toBeNull()
  })

  it('appends chunks during streaming', () => {
    useChatStore.getState().startStreaming('test message')
    useChatStore.getState().appendChunk('Hello ')
    useChatStore.getState().appendChunk('world!')

    expect(useChatStore.getState().streamingMessage).toBe('Hello world!')
  })

  it('finishes streaming', () => {
    useChatStore.getState().startStreaming('test message')
    useChatStore.getState().appendChunk('test')
    useChatStore.getState().finishStreaming()

    const state = useChatStore.getState()
    expect(state.isStreaming).toBe(false)
    expect(state.streamingMessage).toBe('') // Cleared on finish
  })

  it('sets stream error and clears all optimistic state', () => {
    useChatStore.getState().startStreaming('test message')
    useChatStore.getState().appendChunk('partial')
    useChatStore.getState().setStreamError('Connection failed')

    const state = useChatStore.getState()
    expect(state.streamError).toBe('Connection failed')
    expect(state.isStreaming).toBe(false)
    expect(state.pendingUserMessage).toBeNull()
    expect(state.streamingMessage).toBe('')
  })

  it('resets all streaming state', () => {
    useChatStore.getState().startStreaming('test message')
    useChatStore.getState().appendChunk('partial')
    useChatStore.getState().setStreamError('err')
    useChatStore.getState().setCrisisResources('Call 988')
    useChatStore.getState().resetStreamingState()

    const state = useChatStore.getState()
    expect(state.streamingMessage).toBe('')
    expect(state.isStreaming).toBe(false)
    expect(state.streamError).toBeNull()
    expect(state.crisisResources).toBeNull()
  })

  it('setCrisisResources sets and clears correctly', () => {
    useChatStore.getState().setCrisisResources('Call 988')
    expect(useChatStore.getState().crisisResources).toBe('Call 988')

    useChatStore.getState().setCrisisResources(null)
    expect(useChatStore.getState().crisisResources).toBeNull()
  })

  it('startStreaming clears crisis resources', () => {
    useChatStore.getState().setCrisisResources('Call 988')
    useChatStore.getState().startStreaming('test message')

    expect(useChatStore.getState().crisisResources).toBeNull()
  })

  it('setActiveConversation clears crisis resources', () => {
    useChatStore.getState().setCrisisResources('Call 988')
    useChatStore.getState().setActiveConversation('conv-2')

    expect(useChatStore.getState().crisisResources).toBeNull()
  })
})

describe('useChatStore — persistence contract', () => {
  it('chat store is not wrapped in zustand persist middleware', () => {
    // Regression lock: the chat store holds ephemeral streaming state
    // that must NOT survive a cold start (`pendingUserMessage`,
    // `streamingMessage`, `isStreaming`, etc.). Persistence of any of
    // those fields would show the user a stale optimistic-send bubble
    // on next launch. If cold-start persistence is ever needed (e.g.
    // last-opened chat id), it belongs in a separate persisted store —
    // see `src/stores/last-chat.ts`.
    //
    // Zustand's `persist` middleware attaches a `.persist` namespace
    // (getOptions/rehydrate/clearStorage/etc). Its absence proves no
    // official zustand `persist` wrapper is applied.
    expect((useChatStore as unknown as { persist?: unknown }).persist).toBeUndefined()
  })
})
