import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, waitFor } from '../../../src/test/render'
import { makeFirebaseUser, makeOnboardedUserProfile } from '../../../src/test/fixtures'

const { mockReplace, mockMutateAsync, mockSetUser, mockShowToast, mockUseParams } = vi.hoisted(
  () => ({
    mockReplace: vi.fn(),
    mockMutateAsync: vi.fn(),
    mockSetUser: vi.fn(),
    mockShowToast: vi.fn(),
    mockUseParams: vi.fn(),
  }),
)

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
    const state = {
      user: makeFirebaseUser(),
      setUser: mockSetUser,
    }
    return selector ? selector(state) : state
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
})

describe('ConsentScreen — handleFinish', () => {
  it('calls the onboarding mutation with displayName + city from params', async () => {
    mockMutateAsync.mockResolvedValueOnce(makeOnboardedUserProfile())
    const { getByLabelText } = render(<ConsentScreen />)

    fireEvent.press(getByLabelText(/understand/i))

    await waitFor(() =>
      expect(mockMutateAsync).toHaveBeenCalledWith({ displayName: 'Alice', city: 'Luzern' }),
    )
  })

  it('patches the auth store with the updated profile on success', async () => {
    const profile = makeOnboardedUserProfile({ city: 'Luzern' })
    mockMutateAsync.mockResolvedValueOnce(profile)
    const { getByLabelText } = render(<ConsentScreen />)

    fireEvent.press(getByLabelText(/understand/i))

    await waitFor(() => expect(mockSetUser).toHaveBeenCalledTimes(1))
    const [firebaseUser, dbUser] = mockSetUser.mock.calls[0]
    expect(firebaseUser).toBeTruthy()
    expect(dbUser).toEqual(profile)
  })

  it('redirects to the tabs after a successful finish', async () => {
    mockMutateAsync.mockResolvedValueOnce(makeOnboardedUserProfile())
    const { getByLabelText } = render(<ConsentScreen />)

    fireEvent.press(getByLabelText(/understand/i))

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(tabs)'))
  })

  it('does NOT redirect when the mutation fails', async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error('Network down'))
    const { getByLabelText } = render(<ConsentScreen />)

    fireEvent.press(getByLabelText(/understand/i))

    await waitFor(() => expect(mockShowToast).toHaveBeenCalled())
    expect(mockReplace).not.toHaveBeenCalled()
    expect(mockSetUser).not.toHaveBeenCalled()
  })

  it('shows a toast with the error message on failure', async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error('Server offline'))
    const { getByLabelText } = render(<ConsentScreen />)

    fireEvent.press(getByLabelText(/understand/i))

    await waitFor(() => expect(mockShowToast).toHaveBeenCalled())
    const [title, opts] = mockShowToast.mock.calls[0]
    expect(title).toMatch(/setup/i)
    expect(opts?.message).toMatch(/server offline/i)
  })
})
