import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react-native'
import { FirebaseError } from 'firebase/app'
import type { User as FirebaseUser } from 'firebase/auth'
import { makeFirebaseUser, makeUserProfile } from '../../test/fixtures'
import { secureStoreMap } from '../../test/setup'
import { useChatStore } from '../../stores/chat'
import { useLastChatStore } from '../../stores/last-chat'

// Capture the onAuthStateChanged callback so we can trigger it in tests
let capturedCallback: ((user: FirebaseUser | null) => Promise<void>) | null = null
const mockUnsubscribe = vi.fn()

vi.mock('firebase/auth', () => ({
  initializeAuth: vi.fn(() => ({})),
  getAuth: vi.fn(() => ({})),
  getReactNativePersistence: vi.fn(() => ({})),
  onAuthStateChanged: vi.fn((_auth: unknown, cb: (user: FirebaseUser | null) => void) => {
    capturedCallback = cb as (user: FirebaseUser | null) => Promise<void>
    return mockUnsubscribe
  }),
}))

vi.mock('../../lib/firebase', () => ({
  auth: { currentUser: null },
}))

vi.mock('../../api/client', () => ({
  apiRequest: vi.fn(),
}))

import { apiRequest } from '../../api/client'
import { useAuthStore } from '../../stores/auth'
import { useAuth } from '../useAuth'

const mockApiRequest = vi.mocked(apiRequest)

beforeEach(() => {
  capturedCallback = null
  mockUnsubscribe.mockReset()
  mockApiRequest.mockReset()
  useAuthStore.setState({ user: null, dbUser: null, isLoading: true, syncError: null })
  // Reset chat store to its declared initial state so previous tests'
  // ephemeral streaming state doesn't leak into assertions below.
  useChatStore.setState(useChatStore.getInitialState(), true)
  // Reset persisted last-chat pointer between tests — each test builds
  // its own state from a known blank slate.
  useLastChatStore.setState({ lastChatId: null, lastChatUpdatedAt: null })
  Object.keys(secureStoreMap).forEach((k) => delete secureStoreMap[k])
})

describe('useAuth — signed out', () => {
  it('clears store when firebaseUser is null', async () => {
    renderHook(() => useAuth())

    await act(async () => {
      await capturedCallback?.(null)
    })

    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.dbUser).toBeNull()
    expect(state.isLoading).toBe(false)
    expect(state.syncError).toBeNull()
  })

  it('clears the persisted last-chat pointer on logout (session-handoff defense)', async () => {
    // Regression lock: within a single process, user A signs in →
    // chat detail screen persists lastChatId → user A signs out →
    // user B signs in → without this reset, B's first Chat tab focus
    // would <Redirect> to A's most-recent chat id. The detail screen's
    // 404 handler would eventually clear it, but for one frame B sees
    // A's chat pointer. Clearing on logout closes that leak.
    const firebaseUser = makeFirebaseUser()
    useAuthStore.setState({ user: firebaseUser, dbUser: null, isLoading: false, syncError: null })
    // Simulate user A having opened a chat.
    useLastChatStore.getState().setLastChat('user-a-chat-id', Date.now())
    expect(useLastChatStore.getState().lastChatId).toBe('user-a-chat-id')

    renderHook(() => useAuth())

    await act(async () => {
      await capturedCallback?.(null)
    })

    expect(useLastChatStore.getState().lastChatId).toBeNull()
    expect(useLastChatStore.getState().lastChatUpdatedAt).toBeNull()
  })

  it('preserves syncError when firebaseUser becomes null', async () => {
    useAuthStore.setState({ syncError: 'This account has been disabled. Please contact support.' })

    renderHook(() => useAuth())

    await act(async () => {
      await capturedCallback?.(null)
    })

    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.syncError).toBe('This account has been disabled. Please contact support.')
  })

  it('sets session-ended error on unexpected sign-out (e.g. account disabled)', async () => {
    const firebaseUser = makeFirebaseUser()
    useAuthStore.setState({ user: firebaseUser, dbUser: null, isLoading: false, syncError: null })

    renderHook(() => useAuth())

    await act(async () => {
      await capturedCallback?.(null)
    })

    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.syncError).toBe('Your session has ended. Please sign in again.')
  })

  it('sets session-ended error on cold start when stored token exists but Firebase returns null', async () => {
    // Simulate cold start: store is fresh (no prevUser) but token was persisted from previous session
    secureStoreMap['halo_last_token'] = 'old-token'

    renderHook(() => useAuth())

    await act(async () => {
      await capturedCallback?.(null)
    })

    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.syncError).toBe('Your session has ended. Please sign in again.')
    expect(secureStoreMap['halo_last_token']).toBeUndefined()
  })
})

describe('useAuth — signed in', () => {
  it('gets token, stores it, syncs with backend (upsert), sets user', async () => {
    const firebaseUser = makeFirebaseUser()
    const profile = makeUserProfile()
    mockApiRequest.mockResolvedValueOnce({ success: true, data: profile })

    renderHook(() => useAuth())

    await act(async () => {
      await capturedCallback?.(firebaseUser)
    })

    expect(firebaseUser.getIdToken).toHaveBeenCalled()
    expect(secureStoreMap['halo_last_token']).toBe('mock-id-token')
    // Sync is the single API call — sends displayName for upsert
    expect(mockApiRequest).toHaveBeenCalledWith('/v1/auth/sync', {
      method: 'POST',
      body: JSON.stringify({ displayName: firebaseUser.displayName }),
    })
    // No second API call (register) — sync handles everything
    expect(mockApiRequest).toHaveBeenCalledTimes(1)

    const state = useAuthStore.getState()
    expect(state.user).toBe(firebaseUser)
    expect(state.dbUser).toEqual(profile)
    expect(state.isLoading).toBe(false)
  })

  it('sets syncError when sync fails after retry', async () => {
    const firebaseUser = makeFirebaseUser()
    // Both calls fail — syncWithRetry retries once on failure
    mockApiRequest
      .mockResolvedValueOnce({ success: false, error: 'Rate limit exceeded' })
      .mockResolvedValueOnce({ success: false, error: 'Rate limit exceeded' })

    renderHook(() => useAuth())

    await act(async () => {
      await capturedCallback?.(firebaseUser)
    })

    expect(mockApiRequest).toHaveBeenCalledTimes(2)
    const state = useAuthStore.getState()
    expect(state.user).toBe(firebaseUser)
    expect(state.dbUser).toBeNull()
    expect(state.syncError).toBe('Rate limit exceeded')
  })

  it('retries sync once on network failure then succeeds', async () => {
    const firebaseUser = makeFirebaseUser()
    const profile = makeUserProfile()
    // apiRequest returns { success: false } on network error (does not throw)
    mockApiRequest
      .mockResolvedValueOnce({
        success: false,
        error: 'Network error. Please check your connection.',
      })
      .mockResolvedValueOnce({ success: true, data: profile })

    renderHook(() => useAuth())

    await act(async () => {
      await capturedCallback?.(firebaseUser)
    })

    expect(mockApiRequest).toHaveBeenCalledTimes(2)
    const state = useAuthStore.getState()
    expect(state.dbUser).toEqual(profile)
    expect(state.syncError).toBeNull()
  })

  it('sets syncError after retry exhaustion', async () => {
    const firebaseUser = makeFirebaseUser()
    // Both calls return failure envelopes (matching real apiRequest behavior)
    mockApiRequest
      .mockResolvedValueOnce({
        success: false,
        error: 'Network error. Please check your connection.',
      })
      .mockResolvedValueOnce({
        success: false,
        error: 'Network error. Please check your connection.',
      })

    renderHook(() => useAuth())

    await act(async () => {
      await capturedCallback?.(firebaseUser)
    })

    expect(mockApiRequest).toHaveBeenCalledTimes(2)
    const state = useAuthStore.getState()
    expect(state.user).toBe(firebaseUser)
    expect(state.dbUser).toBeNull()
    expect(state.syncError).toBe('Network error. Please check your connection.')
  })

  it('continues sync when SecureStore.setItemAsync fails', async () => {
    const firebaseUser = makeFirebaseUser()
    const profile = makeUserProfile()
    mockApiRequest.mockResolvedValueOnce({ success: true, data: profile })
    // Make SecureStore.setItemAsync throw
    secureStoreMap['__setItem_throw'] = 'true'

    renderHook(() => useAuth())

    await act(async () => {
      await capturedCallback?.(firebaseUser)
    })

    // Sync should still succeed despite SecureStore failure
    const state = useAuthStore.getState()
    expect(state.user).toBe(firebaseUser)
    expect(state.dbUser).toEqual(profile)
  })
})

describe('useAuth — Firebase auth errors', () => {
  it('sets user-friendly syncError when account is disabled', async () => {
    const firebaseUser = makeFirebaseUser()
    firebaseUser.getIdToken = vi
      .fn()
      .mockRejectedValue(
        new FirebaseError('auth/user-disabled', 'Firebase: Error (auth/user-disabled).'),
      )

    renderHook(() => useAuth())

    await act(async () => {
      await capturedCallback?.(firebaseUser)
    })

    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.dbUser).toBeNull()
    expect(state.syncError).toBe('This account has been disabled. Please contact support.')
  })

  it('sets session expired error when token is revoked', async () => {
    const firebaseUser = makeFirebaseUser()
    firebaseUser.getIdToken = vi
      .fn()
      .mockRejectedValue(
        new FirebaseError('auth/id-token-revoked', 'Firebase: Error (auth/id-token-revoked).'),
      )

    renderHook(() => useAuth())

    await act(async () => {
      await capturedCallback?.(firebaseUser)
    })

    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.syncError).toBe('Your session has expired. Please sign in again.')
  })

  it('rethrows TypeError (programming errors are not swallowed)', async () => {
    const firebaseUser = makeFirebaseUser()
    firebaseUser.getIdToken = vi.fn().mockRejectedValue(new TypeError('Cannot read property'))

    renderHook(() => useAuth())

    await expect(
      act(async () => {
        await capturedCallback?.(firebaseUser)
      }),
    ).rejects.toThrow(TypeError)
  })
})

describe('useAuth — cleanup', () => {
  it('calls unsubscribe on unmount', () => {
    const { unmount } = renderHook(() => useAuth())
    unmount()
    expect(mockUnsubscribe).toHaveBeenCalled()
  })
})
