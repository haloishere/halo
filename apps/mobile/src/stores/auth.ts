import { create } from 'zustand'
import type { User as FirebaseUser } from 'firebase/auth'
import type { UserProfile } from '@halo/shared'

interface AuthState {
  user: FirebaseUser | null
  dbUser: UserProfile | null
  isLoading: boolean
  syncError: string | null
  setUser(user: FirebaseUser | null, dbUser: UserProfile | null): void
  setSyncError(error: string | null): void
  clearUser(preserveSyncError?: string | null): void
  setLoading(loading: boolean): void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  dbUser: null,
  isLoading: true,
  syncError: null,
  setUser: (user, dbUser) => set({ user, dbUser, isLoading: false, syncError: null }),
  setSyncError: (syncError) => set({ syncError }),
  clearUser: (preserveSyncError) =>
    set({ user: null, dbUser: null, isLoading: false, syncError: preserveSyncError ?? null }),
  setLoading: (isLoading) => set({ isLoading }),
}))
