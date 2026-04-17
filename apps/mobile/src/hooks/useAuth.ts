import { useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import * as SecureStore from 'expo-secure-store'
import { auth } from '../lib/firebase'
import { useAuthStore } from '../stores/auth'
import { useChatStore } from '../stores/chat'
import { useLastChatStore } from '../stores/last-chat'
import { apiRequest } from '../api/client'
import { getAuthErrorMessage } from '../lib/auth-errors'
import type { UserProfile } from '@halo/shared'

const STORED_TOKEN_KEY = 'halo_last_token'

const SYNC_RETRY_DELAY_MS = 1000

export function useAuth() {
  const { setUser, clearUser, setLoading, setSyncError } = useAuthStore()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        const { user: prevUser, syncError } = useAuthStore.getState()
        const hadStoredToken = await SecureStore.getItemAsync(STORED_TOKEN_KEY).catch((err) => {
          if (__DEV__) console.warn('SecureStore read failed:', err)
          return null
        })
        await SecureStore.deleteItemAsync(STORED_TOKEN_KEY).catch((err) => {
          if (__DEV__) console.warn('SecureStore delete failed:', err)
        })

        // Reset session-scoped chat store state on every sign-out so a
        // different user signing in on the same process does not inherit
        // the outgoing user's streaming / pending-message state. Full
        // replace-mode reset (`true` second arg) picks up any future
        // ChatState fields automatically.
        useChatStore.setState(useChatStore.getInitialState(), true)

        // Also clear the PERSISTED last-chat pointer — otherwise User B
        // signing in on the same device would be redirected to User A's
        // most-recent conversation id (the detail screen's 404 handler
        // would catch it eventually, but the leak is observable by the
        // user for one frame and, more importantly, leaves a signal of
        // the previous user on disk).
        useLastChatStore.getState().clearLastChat()

        // Preserve existing syncError, or detect *unexpected* sign-out.
        // If prevUser is already null, this was an intentional sign-out
        // (profile screen called clearUser() before signOut) — no error.
        if (syncError) {
          clearUser(syncError)
        } else if (prevUser || hadStoredToken) {
          clearUser('Your session has ended. Please sign in again.')
        } else {
          clearUser()
        }
        return
      }

      try {
        setLoading(true)
        const token = await firebaseUser.getIdToken()

        // Store token — non-fatal if SecureStore fails
        await SecureStore.setItemAsync(STORED_TOKEN_KEY, token).catch((err) => {
          if (__DEV__) console.warn('SecureStore write failed:', err)
        })

        // Single API call: sync upserts (creates DB user if not found)
        // Retries once on failure before giving up
        const displayName = firebaseUser.displayName ?? undefined
        const syncResult = await syncWithRetry(displayName)

        if (syncResult.success) {
          setUser(firebaseUser, syncResult.data ?? null)
        } else {
          setUser(firebaseUser, null)
          setSyncError(syncResult.error ?? 'Account setup failed. Please try again.')
        }
      } catch (err) {
        // Firebase auth errors (disabled, revoked) or network failures
        const message = getAuthErrorMessage(err)
        clearUser(message)
        // Rethrow programming errors (bugs) — only swallow network/API failures
        if (err instanceof TypeError || err instanceof ReferenceError) {
          throw err
        }
      }
    })

    return unsubscribe
  }, [setUser, clearUser, setLoading, setSyncError])

  return useAuthStore()
}

async function syncWithRetry(displayName: string | undefined) {
  const body = JSON.stringify({ displayName })
  const opts = { method: 'POST', body } as const
  const result = await apiRequest<UserProfile>('/v1/auth/sync', opts)
  if (result.success) return result
  // First attempt failed — retry once after delay
  await new Promise((r) => setTimeout(r, SYNC_RETRY_DELAY_MS))
  return apiRequest<UserProfile>('/v1/auth/sync', opts)
}
