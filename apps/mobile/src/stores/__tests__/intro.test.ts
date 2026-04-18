import { describe, it, expect, beforeEach } from 'vitest'
import { useIntroStore } from '../intro'

beforeEach(() => {
  // Reset BOTH fields — `hydrated` flips async via onRehydrateStorage
  // on store creation and would otherwise leak between tests.
  useIntroStore.setState({ hasSeen: false, hydrated: false }, false)
})

describe('useIntroStore — initial state', () => {
  it('starts unseen', () => {
    expect(useIntroStore.getState().hasSeen).toBe(false)
  })

  it('starts un-hydrated so the router gate can show a spinner on cold boot', () => {
    expect(useIntroStore.getState().hydrated).toBe(false)
  })
})

describe('useIntroStore — markSeen', () => {
  it('flips hasSeen to true', () => {
    useIntroStore.getState().markSeen()
    expect(useIntroStore.getState().hasSeen).toBe(true)
  })

  it('is idempotent', () => {
    useIntroStore.getState().markSeen()
    useIntroStore.getState().markSeen()
    expect(useIntroStore.getState().hasSeen).toBe(true)
  })

  it('does not touch the hydrated flag', () => {
    useIntroStore.setState({ hydrated: true })
    useIntroStore.getState().markSeen()
    expect(useIntroStore.getState().hydrated).toBe(true)
  })
})

describe('useIntroStore — hydration lifecycle', () => {
  // Mirrors what `onRehydrateStorage` does when AsyncStorage rehydration finishes.
  // If this ever regresses, app/index.tsx gets stuck on its spinner forever.
  it('accepts hydrated: true once rehydration completes', () => {
    expect(useIntroStore.getState().hydrated).toBe(false)
    useIntroStore.setState({ hydrated: true })
    expect(useIntroStore.getState().hydrated).toBe(true)
  })
})

describe('useIntroStore — persistence contract', () => {
  // `partialize` decides what ends up in AsyncStorage. `hydrated` MUST NOT
  // be persisted, otherwise a restore would flip it to `false` at startup
  // and the app would deadlock on the spinner before onRehydrateStorage
  // has a chance to set it back to `true`.
  it('persists only hasSeen', () => {
    const partialize = useIntroStore.persist.getOptions().partialize
    expect(partialize).toBeDefined()

    const snapshot = partialize!({
      hasSeen: true,
      hydrated: true,
      markSeen: () => {},
    })

    expect(snapshot).toEqual({ hasSeen: true })
    expect(snapshot).not.toHaveProperty('hydrated')
  })
})
