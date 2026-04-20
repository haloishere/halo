import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '../../../src/test/render'

const { mockPush } = vi.hoisted(() => ({ mockPush: vi.fn() }))

vi.mock('expo-router', () => ({
  router: { push: mockPush },
  useLocalSearchParams: vi.fn().mockReturnValue({}),
}))

import { useLocalSearchParams } from 'expo-router'
import CityScreen from '../city'

const mockUseParams = vi.mocked(useLocalSearchParams)

beforeEach(() => {
  mockPush.mockReset()
  mockUseParams.mockReturnValue({ name: 'Alice' } as ReturnType<typeof useLocalSearchParams>)
})

describe('CityScreen — rendering', () => {
  it('renders all four cities', () => {
    const { getByText } = render(<CityScreen />)
    expect(getByText('Luzern')).toBeTruthy()
    expect(getByText('Zürich')).toBeTruthy()
    expect(getByText('Basel')).toBeTruthy()
    expect(getByText('Somewhere else')).toBeTruthy()
  })

  it('Continue button is enabled with a default selection', () => {
    const { getByLabelText } = render(<CityScreen />)
    expect(getByLabelText('Continue').props.accessibilityState?.disabled).toBe(false)
  })
})

describe('CityScreen — navigation', () => {
  it('forwards name + selected city to consent', () => {
    const { getByLabelText } = render(<CityScreen />)
    fireEvent.press(getByLabelText('Continue'))
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(onboarding)/consent',
      params: { name: 'Alice', city: 'luzern' },
    })
  })

  it('forwards an alternate city selection', () => {
    const { getByText, getByLabelText } = render(<CityScreen />)
    fireEvent.press(getByText('Basel'))
    fireEvent.press(getByLabelText('Continue'))
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(onboarding)/consent',
      params: { name: 'Alice', city: 'basel' },
    })
  })

  it('forwards empty name when params.name is missing', () => {
    mockUseParams.mockReturnValue({} as ReturnType<typeof useLocalSearchParams>)
    const { getByLabelText } = render(<CityScreen />)
    fireEvent.press(getByLabelText('Continue'))
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(onboarding)/consent',
      params: { name: '', city: 'luzern' },
    })
  })
})
