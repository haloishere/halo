import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, waitFor } from '../../../src/test/render'
import { makeFirebaseUser, makeOnboardedUserProfile } from '../../../src/test/fixtures'

const { mockReplace, mockMutateAsync, mockSetUser, mockShowToast, mockUseParams, mockAuthState } =
  vi.hoisted(() => ({
    mockReplace: vi.fn(),
    mockMutateAsync: vi.fn(),
    mockSetUser: vi.fn(),
    mockShowToast: vi.fn(),
    mockUseParams: vi.fn(),
    // Mutable so individual tests can swap the user (e.g. expired session = null).
    mockAuthState: { user: null as unknown, setUser: null as unknown as (...args: unknown[]) => void },
  }))

vi.mock('expo-router', () => ({
  router: { replace: mockReplace },
  useLocalSearchParams: mockUseParams,
}))

vi.mock('../../../src/api/users', () => ({
  useOnboardingMutation: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}))

vi.mock('../../../src/stores/auth', () => ({
  useAuthStore: (selector?: (s: unknown) => unknown) => {
    return selector ? selector(mockAuthState) : mockAuthState
  },
}))

vi.mock('@tamagui/toast', () => ({
  useToastController: () => ({ show: mockShowToast }),
}))

// Tamagui's themed icon wrappers resolve color tokens via useTheme; in the
// test env the `accent` sub-theme isn't mounted, so lucide icons throw
// "Missing theme." Stubbed with null-render components — we don't assert
// on icons anyway.
vi.mock('@tamagui/lucide-icons', () => ({
  ShieldCheck: () => null,
  Key: () => null,
  History: () => null,
  Trash2: () => null,
}))

import ConsentScreen from '../consent'

beforeEach(() => {
  mockReplace.mockReset()
  mockMutateAsync.mockReset()
  mockSetUser.mockReset()
  mockShowToast.mockReset()
  mockUseParams.mockReturnValue({ name: 'Alice', city: 'Luzern' })
  // Reset the auth state to a signed-in user for every test. Individual
  // tests that need an expired session just reassign `mockAuthState.user`.
  mockAuthState.user = makeFirebaseUser()
  mockAuthState.setUser = mockSetUser as unknown as (...args: unknown[]) => void
})

describe('ConsentScreen — handleFinish', () => {
  it('calls the onboarding mutation with displayName + city from params', async () => {
    mockMutateAsync.mockResolvedValueOnce(makeOnboardedUserProfile())
    const { getByLabelText } = render(<ConsentScreen />)

    fireEvent.press(getByLabelText('Finish onboarding'))

    await waitFor(() =>
      expect(mockMutateAsync).toHaveBeenCalledWith({ displayName: 'Alice', city: 'Luzern' }),
    )
  })

  it('patches the auth store with the updated profile on success', async () => {
    const profile = makeOnboardedUserProfile({ city: 'Luzern' })
    mockMutateAsync.mockResolvedValueOnce(profile)
    const { getByLabelText } = render(<ConsentScreen />)

    fireEvent.press(getByLabelText('Finish onboarding'))

    await waitFor(() => expect(mockSetUser).toHaveBeenCalledTimes(1))
    const [firebaseUser, dbUser] = mockSetUser.mock.calls[0]
    expect(firebaseUser).toBeTruthy()
    expect(dbUser).toEqual(profile)
  })

  it('redirects to the tabs after a successful finish', async () => {
    mockMutateAsync.mockResolvedValueOnce(makeOnboardedUserProfile())
    const { getByLabelText } = render(<ConsentScreen />)

    fireEvent.press(getByLabelText('Finish onboarding'))

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(tabs)'))
  })

  it('does NOT redirect when the mutation fails', async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error('Network down'))
    const { getByLabelText } = render(<ConsentScreen />)

    fireEvent.press(getByLabelText('Finish onboarding'))

    await waitFor(() => expect(mockShowToast).toHaveBeenCalled())
    expect(mockReplace).not.toHaveBeenCalled()
    expect(mockSetUser).not.toHaveBeenCalled()
  })

  it('redirects to auth when the Firebase session expired before finish', async () => {
    mockAuthState.user = null
    const { getByLabelText } = render(<ConsentScreen />)

    fireEvent.press(getByLabelText('Finish onboarding'))

    await waitFor(() => expect(mockShowToast).toHaveBeenCalled())
    const [title] = mockShowToast.mock.calls[0]
    expect(title).toMatch(/session/i)
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/enter-email')
    expect(mockMutateAsync).not.toHaveBeenCalled()
    expect(mockSetUser).not.toHaveBeenCalled()
  })

  it('shows a toast with the error message on failure', async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error('Server offline'))
    const { getByLabelText } = render(<ConsentScreen />)

    fireEvent.press(getByLabelText('Finish onboarding'))

    await waitFor(() => expect(mockShowToast).toHaveBeenCalled())
    const [title, opts] = mockShowToast.mock.calls[0]
    expect(title).toMatch(/setup/i)
    expect(opts?.message).toMatch(/server offline/i)
  })
})
