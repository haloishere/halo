import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from '../../stores/auth'
import { makeFirebaseUser, makeUserProfile, makeOnboardedUserProfile } from '../../test/fixtures'

beforeEach(() => {
  useAuthStore.setState({ user: null, dbUser: null, isLoading: true, syncError: null })
})

describe('useAuthStore — initial state', () => {
  it('starts with null user, null dbUser, isLoading true', () => {
    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.dbUser).toBeNull()
    expect(state.isLoading).toBe(true)
  })
})

describe('useAuthStore — setUser', () => {
  it('sets user and dbUser, clears loading', () => {
    const user = makeFirebaseUser()
    const dbUser = makeUserProfile()
    useAuthStore.getState().setUser(user, dbUser)

    const state = useAuthStore.getState()
    expect(state.user).toBe(user)
    expect(state.dbUser).toBe(dbUser)
    expect(state.isLoading).toBe(false)
  })

  it('allows setting dbUser to null (Firebase user only)', () => {
    const user = makeFirebaseUser()
    useAuthStore.getState().setUser(user, null)

    expect(useAuthStore.getState().user).toBe(user)
    expect(useAuthStore.getState().dbUser).toBeNull()
    expect(useAuthStore.getState().isLoading).toBe(false)
  })
})

describe('useAuthStore — clearUser', () => {
  it('clears both users and sets isLoading false', () => {
    useAuthStore.setState({ user: makeFirebaseUser(), dbUser: makeUserProfile(), isLoading: false })
    useAuthStore.getState().clearUser()

    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.dbUser).toBeNull()
    expect(state.isLoading).toBe(false)
  })
})

describe('useAuthStore — setLoading', () => {
  it('updates isLoading to false', () => {
    useAuthStore.getState().setLoading(false)
    expect(useAuthStore.getState().isLoading).toBe(false)
  })

  it('updates isLoading to true', () => {
    useAuthStore.setState({ isLoading: false })
    useAuthStore.getState().setLoading(true)
    expect(useAuthStore.getState().isLoading).toBe(true)
  })
})

describe('useAuthStore — syncError', () => {
  it('setSyncError stores the error message', () => {
    useAuthStore.getState().setSyncError('Rate limit exceeded')
    expect(useAuthStore.getState().syncError).toBe('Rate limit exceeded')
  })

  it('setUser clears syncError', () => {
    useAuthStore.setState({ syncError: 'some error' })
    useAuthStore.getState().setUser(makeFirebaseUser(), makeUserProfile())
    expect(useAuthStore.getState().syncError).toBeNull()
  })

  it('clearUser clears syncError by default', () => {
    useAuthStore.setState({ syncError: 'some error' })
    useAuthStore.getState().clearUser()
    expect(useAuthStore.getState().syncError).toBeNull()
  })

  it('clearUser preserves syncError when passed as argument', () => {
    const errorMsg = 'This account has been disabled.'
    useAuthStore.setState({
      user: makeFirebaseUser(),
      dbUser: makeUserProfile(),
      syncError: errorMsg,
    })
    useAuthStore.getState().clearUser(errorMsg)
    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.dbUser).toBeNull()
    expect(state.isLoading).toBe(false)
    expect(state.syncError).toBe(errorMsg)
  })
})

describe('useAuthStore — onboarding status via dbUser', () => {
  it('dbUser with onboardingCompleted indicates completed onboarding', () => {
    const profile = makeOnboardedUserProfile()
    useAuthStore.getState().setUser(makeFirebaseUser(), profile)
    expect(useAuthStore.getState().dbUser?.onboardingCompleted).not.toBeNull()
  })

  it('dbUser without onboardingCompleted indicates incomplete onboarding', () => {
    const profile = makeUserProfile()
    useAuthStore.getState().setUser(makeFirebaseUser(), profile)
    expect(useAuthStore.getState().dbUser?.onboardingCompleted).toBeNull()
  })
})
