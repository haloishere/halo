/**
 * Persisted "last opened chat" store.
 *
 * Survives app cold start via AsyncStorage + zustand's `persist`
 * middleware. This is the source of truth the Chat tab redirect uses
 * to decide where to send the user on every focus:
 *
 *   - If `lastChatId` is set AND `lastChatUpdatedAt` is within 2h of
 *     now, redirect to `/chat/{lastChatId}` (the 2h rule, applied
 *     against the persisted timestamp — no network on the hot path).
 *   - Otherwise redirect to `/chat/new` (lazy creation sentinel).
 *
 * Separate from `useChatStore` because that store holds ephemeral
 * streaming state (`pendingUserMessage`, `crisisResources`, etc.)
 * which MUST NOT persist across cold starts — see the doc comment
 * on `hasInitializedChatTab` in `chat.ts`. The split keeps the
 * persistence boundary explicit: everything in THIS store is
 * persisted, everything in `chat.ts` is in-memory.
 *
 * Lifecycle:
 *   - `setLastChat(id, updatedAt)` — called from `chat/[id].tsx`
 *     whenever the screen focuses for a real conversation id, and
 *     bumped on each successful message send.
 *   - `clearLastChat()` — called from:
 *     1. `chat/[id].tsx` when the conversation query 404s (server
 *        no longer has this id — e.g. deleted on another device).
 *     2. `useAuth.ts` on logout, so User A's last chat doesn't leak
 *        to User B on the same device.
 */
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

interface LastChatState {
  lastChatId: string | null
  lastChatUpdatedAt: number | null
  setLastChat: (id: string, updatedAt: number) => void
  clearLastChat: () => void
}

export const useLastChatStore = create<LastChatState>()(
  persist(
    (set) => ({
      lastChatId: null,
      lastChatUpdatedAt: null,
      setLastChat: (id, updatedAt) => set({ lastChatId: id, lastChatUpdatedAt: updatedAt }),
      clearLastChat: () => set({ lastChatId: null, lastChatUpdatedAt: null }),
    }),
    {
      name: 'halo-last-chat',
      storage: createJSONStorage(() => AsyncStorage),
      // Only the two data fields are persisted — the actions are
      // recreated by the factory on every cold start.
      partialize: (state) => ({
        lastChatId: state.lastChatId,
        lastChatUpdatedAt: state.lastChatUpdatedAt,
      }),
      onRehydrateStorage: () => (_state, error) => {
        if (error) console.warn('[LastChatStore] Failed to restore last chat:', error)
      },
    },
  ),
)
