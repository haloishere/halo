import { describe, it, expect, beforeEach } from 'vitest'
import { useLastChatStore } from '../last-chat'

// The store is backed by zustand persist + AsyncStorage. The test env's
// async-storage mock (see src/test/setup.ts) is already in-memory, so
// hydration is synchronous enough to assert against immediately.

beforeEach(() => {
  // Reset the store to its declared initial state between tests so
  // persist's rehydrated value from previous tests doesn't leak.
  useLastChatStore.setState(
    { lastChatId: null, lastChatUpdatedAt: null },
    false,
  )
})

describe('useLastChatStore — initial state', () => {
  it('starts with null id and null timestamp', () => {
    const { lastChatId, lastChatUpdatedAt } = useLastChatStore.getState()
    expect(lastChatId).toBeNull()
    expect(lastChatUpdatedAt).toBeNull()
  })
})

describe('useLastChatStore — setLastChat', () => {
  it('sets id and timestamp together', () => {
    useLastChatStore.getState().setLastChat('chat-a', 1234567890)
    const { lastChatId, lastChatUpdatedAt } = useLastChatStore.getState()
    expect(lastChatId).toBe('chat-a')
    expect(lastChatUpdatedAt).toBe(1234567890)
  })

  it('overwrites both fields on subsequent calls', () => {
    useLastChatStore.getState().setLastChat('chat-a', 1000)
    useLastChatStore.getState().setLastChat('chat-b', 2000)
    const { lastChatId, lastChatUpdatedAt } = useLastChatStore.getState()
    expect(lastChatId).toBe('chat-b')
    expect(lastChatUpdatedAt).toBe(2000)
  })
})

describe('useLastChatStore — clearLastChat', () => {
  it('resets id and timestamp to null', () => {
    useLastChatStore.getState().setLastChat('chat-a', 1234567890)
    useLastChatStore.getState().clearLastChat()
    const { lastChatId, lastChatUpdatedAt } = useLastChatStore.getState()
    expect(lastChatId).toBeNull()
    expect(lastChatUpdatedAt).toBeNull()
  })

  it('is idempotent when called on an already-empty store', () => {
    expect(() => {
      useLastChatStore.getState().clearLastChat()
      useLastChatStore.getState().clearLastChat()
    }).not.toThrow()
    const { lastChatId, lastChatUpdatedAt } = useLastChatStore.getState()
    expect(lastChatId).toBeNull()
    expect(lastChatUpdatedAt).toBeNull()
  })
})
