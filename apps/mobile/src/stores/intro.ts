import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

interface IntroState {
  hasSeen: boolean
  hydrated: boolean
  markSeen(): void
}

export const useIntroStore = create<IntroState>()(
  persist(
    (set) => ({
      hasSeen: false,
      hydrated: false,
      markSeen: () => set({ hasSeen: true }),
    }),
    {
      name: 'halo-intro-seen',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ hasSeen: state.hasSeen }),
      onRehydrateStorage: () => (_state, error) => {
        if (error) console.warn('[IntroStore] Failed to restore intro flag:', error)
        useIntroStore.setState({ hydrated: true })
      },
    },
  ),
)
