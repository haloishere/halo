import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, act } from '../../../src/test/render'
import { Alert } from 'react-native'
import { makeFirebaseUser, makeOnboardedUserProfile } from '../../../src/test/fixtures'

const { mockReplace } = vi.hoisted(() => ({ mockReplace: vi.fn() }))

vi.mock('expo-router', () => ({
  router: { replace: mockReplace },
  useLocalSearchParams: vi.fn().mockReturnValue({
    name: 'Alice',
    relationship: 'child',
    diagnosisStage: 'early',
  }),
}))

vi.mock('../../../src/api/users', () => ({
  useOnboardingMutation: vi.fn(),
}))

vi.mock('../../../src/stores/auth', () => ({
  useAuthStore: vi.fn(),
}))

import { useOnboardingMutation } from '../../../src/api/users'
import { useAuthStore } from '../../../src/stores/auth'
import ChallengesScreen from '../challenges'

const mockUseOnboardingMutation = vi.mocked(useOnboardingMutation)
const mockUseAuthStore = vi.mocked(useAuthStore)

const mutateAsyncMock = vi.fn()
const setUserMock = vi.fn()

beforeEach(() => {
  mutateAsyncMock.mockReset()
  setUserMock.mockReset()
  mockReplace.mockReset()
  mockUseOnboardingMutation.mockReturnValue({
    mutateAsync: mutateAsyncMock,
    isPending: false,
  } as unknown as ReturnType<typeof useOnboardingMutation>)
  mockUseAuthStore.mockReturnValue({
    setUser: setUserMock,
    user: makeFirebaseUser(),
    dbUser: null,
    isLoading: false,
    clearUser: vi.fn(),
    setLoading: vi.fn(),
  } as ReturnType<typeof useAuthStore>)
  vi.spyOn(Alert, 'alert').mockImplementation(() => {})
})

describe('ChallengesScreen — rendering', () => {
  it('renders all 7 challenge chips', () => {
    const { getByText } = render(<ChallengesScreen />)
    expect(getByText('Behavioral changes')).toBeTruthy()
    expect(getByText('Communication')).toBeTruthy()
    expect(getByText('Daily care routines')).toBeTruthy()
    expect(getByText('My own self-care')).toBeTruthy()
    expect(getByText('Safety at home')).toBeTruthy()
    expect(getByText('Legal & financial matters')).toBeTruthy()
    expect(getByText('Emotional support')).toBeTruthy()
  })

  it('Finish button disabled when no challenges selected', () => {
    const { getByLabelText } = render(<ChallengesScreen />)
    expect(getByLabelText('Finish').props.accessibilityState?.disabled).toBe(true)
  })
})

describe('ChallengesScreen — multi-select', () => {
  it('enables Finish after selecting a challenge', () => {
    const { getByText, getByLabelText } = render(<ChallengesScreen />)
    fireEvent.press(getByText('Communication'))
    expect(getByLabelText('Finish').props.accessibilityState?.disabled).toBe(false)
  })

  it('toggles a chip off when pressed again', () => {
    const { getByText, getByLabelText, getAllByRole } = render(<ChallengesScreen />)
    fireEvent.press(getByText('Communication'))
    fireEvent.press(getByText('Communication'))
    // Back to none selected
    expect(getByLabelText('Finish').props.accessibilityState?.disabled).toBe(true)
    const checkboxes = getAllByRole('checkbox')
    const checkedCount = checkboxes.filter((c) => c.props.accessibilityState?.checked).length
    expect(checkedCount).toBe(0)
  })

  it('allows multiple challenges to be selected', () => {
    const { getByText, getAllByRole } = render(<ChallengesScreen />)
    fireEvent.press(getByText('Communication'))
    fireEvent.press(getByText('Safety at home'))
    const checkboxes = getAllByRole('checkbox')
    const checkedCount = checkboxes.filter((c) => c.props.accessibilityState?.checked).length
    expect(checkedCount).toBe(2)
  })
})

describe('ChallengesScreen — finish onboarding', () => {
  afterEach(async () => {
    const { useLocalSearchParams } = await import('expo-router')
    vi.mocked(useLocalSearchParams).mockReturnValue({
      name: 'Alice',
      relationship: 'child',
      diagnosisStage: 'early',
    })
  })

  it('calls useOnboardingMutation with all params and navigates to tabs', async () => {
    const profile = makeOnboardedUserProfile()
    mutateAsyncMock.mockResolvedValueOnce(profile)
    const firebaseUser = makeFirebaseUser()
    mockUseAuthStore.mockReturnValue({
      setUser: setUserMock,
      user: firebaseUser,
      dbUser: null,
      isLoading: false,
      clearUser: vi.fn(),
      setLoading: vi.fn(),
    } as ReturnType<typeof useAuthStore>)

    const { getByText, getByLabelText } = render(<ChallengesScreen />)
    fireEvent.press(getByText('Communication'))
    fireEvent.press(getByText('Safety at home'))

    await act(async () => {
      fireEvent.press(getByLabelText('Finish'))
    })

    expect(mutateAsyncMock).toHaveBeenCalledWith({
      displayName: 'Alice',
      caregiverRelationship: 'child',
      diagnosisStage: 'early',
      challenges: ['communication', 'safety'],
    })
    expect(setUserMock).toHaveBeenCalledWith(firebaseUser, profile)
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/')
  })

  it('does not include displayName when params.name is empty', async () => {
    const { useLocalSearchParams } = await import('expo-router')
    vi.mocked(useLocalSearchParams).mockReturnValue({
      name: '',
      relationship: 'child',
      diagnosisStage: 'early',
    })

    const profile = makeOnboardedUserProfile()
    mutateAsyncMock.mockResolvedValueOnce(profile)

    const { getByText, getByLabelText } = render(<ChallengesScreen />)
    fireEvent.press(getByText('Communication'))

    await act(async () => {
      fireEvent.press(getByLabelText('Finish'))
    })

    expect(mutateAsyncMock).toHaveBeenCalledWith(
      expect.not.objectContaining({ displayName: expect.anything() }),
    )
  })

  it('excludes displayName when deep-link name contains invalid characters', async () => {
    const { useLocalSearchParams } = await import('expo-router')
    vi.mocked(useLocalSearchParams).mockReturnValue({
      name: '<script>alert(1)</script>',
      relationship: 'child',
      diagnosisStage: 'early',
    })

    const profile = makeOnboardedUserProfile()
    mutateAsyncMock.mockResolvedValueOnce(profile)

    const { getByText, getByLabelText } = render(<ChallengesScreen />)
    fireEvent.press(getByText('Communication'))

    await act(async () => {
      fireEvent.press(getByLabelText('Finish'))
    })

    expect(mutateAsyncMock).toHaveBeenCalledWith(
      expect.not.objectContaining({ displayName: expect.anything() }),
    )
  })

  it('shows Alert when mutation fails', async () => {
    mutateAsyncMock.mockRejectedValueOnce(new Error('Server error'))

    const { getByText, getByLabelText } = render(<ChallengesScreen />)
    fireEvent.press(getByText('Behavioral changes'))

    await act(async () => {
      fireEvent.press(getByLabelText('Finish'))
    })

    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Server error')
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('shows loading state on button while mutation pending', () => {
    mutateAsyncMock.mockReturnValue(new Promise(() => {}))
    mockUseOnboardingMutation.mockReturnValue({
      mutateAsync: mutateAsyncMock,
      isPending: true,
    } as unknown as ReturnType<typeof useOnboardingMutation>)

    const { getByLabelText } = render(<ChallengesScreen />)
    expect(getByLabelText('Finish').props.accessibilityState?.busy).toBe(true)
  })
})
