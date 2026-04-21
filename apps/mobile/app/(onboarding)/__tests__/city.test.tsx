import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Keyboard } from 'react-native'
import { render, fireEvent } from '../../../src/test/render'

const { mockPush } = vi.hoisted(() => ({ mockPush: vi.fn() }))

vi.mock('expo-router', () => ({
  router: { push: mockPush },
  useLocalSearchParams: vi.fn().mockReturnValue({}),
}))

import { useLocalSearchParams } from 'expo-router'
import CityScreen from '../city'

const mockUseParams = vi.mocked(useLocalSearchParams)

const FOCUS_EVENT = { nativeEvent: { target: 0 }, target: { value: '' } }

let dismissSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  mockPush.mockReset()
  mockUseParams.mockReturnValue({ name: 'Alice', age: '30' } as ReturnType<
    typeof useLocalSearchParams
  >)
  dismissSpy = vi.spyOn(Keyboard, 'dismiss').mockImplementation(() => {})
})

afterEach(() => {
  dismissSpy.mockRestore()
})

describe('CityScreen — rendering', () => {
  it('renders the city input', () => {
    const { getByLabelText } = render(<CityScreen />)
    expect(getByLabelText('City')).toBeTruthy()
  })

  it('Continue button disabled when city is empty', () => {
    const { getByLabelText } = render(<CityScreen />)
    expect(getByLabelText('Continue').props.accessibilityState?.disabled).toBe(true)
  })

  it('Continue button enables once a city is typed', () => {
    const { getByLabelText } = render(<CityScreen />)
    fireEvent.changeText(getByLabelText('City'), 'Luzern')
    expect(getByLabelText('Continue').props.accessibilityState?.disabled).toBe(false)
  })
})

describe('CityScreen — typeahead suggestions', () => {
  it('shows matching city suggestions when the input is focused', () => {
    const { getByLabelText, getByText } = render(<CityScreen />)
    fireEvent.changeText(getByLabelText('City'), 'Luz')
    fireEvent(getByLabelText('City'), 'focus', FOCUS_EVENT)
    expect(getByText('Luzern')).toBeTruthy()
    expect(getByText('Switzerland')).toBeTruthy()
  })

  it('tapping a suggestion fills the input with "City, Country"', () => {
    const { getByLabelText } = render(<CityScreen />)
    fireEvent.changeText(getByLabelText('City'), 'Luz')
    fireEvent(getByLabelText('City'), 'focus', FOCUS_EVENT)
    fireEvent.press(getByLabelText('Luzern, Switzerland'))
    expect(getByLabelText('City').props.value).toBe('Luzern, Switzerland')
  })
})

describe('CityScreen — navigation', () => {
  it('forwards name + age + typed city to consent', () => {
    const { getByLabelText } = render(<CityScreen />)
    fireEvent.changeText(getByLabelText('City'), 'Meggen')
    fireEvent.press(getByLabelText('Continue'))
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(onboarding)/consent',
      params: { name: 'Alice', age: '30', city: 'Meggen' },
    })
  })

  it('forwards the canonical "City, Country" string after a suggestion tap', () => {
    const { getByLabelText } = render(<CityScreen />)
    fireEvent.changeText(getByLabelText('City'), 'Luz')
    fireEvent(getByLabelText('City'), 'focus', FOCUS_EVENT)
    fireEvent.press(getByLabelText('Luzern, Switzerland'))
    fireEvent.press(getByLabelText('Continue'))
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(onboarding)/consent',
      params: { name: 'Alice', age: '30', city: 'Luzern, Switzerland' },
    })
  })

  it('handles missing route params by defaulting to empty strings', () => {
    mockUseParams.mockReturnValue({} as ReturnType<typeof useLocalSearchParams>)
    const { getByLabelText } = render(<CityScreen />)
    fireEvent.changeText(getByLabelText('City'), 'Luzern')
    fireEvent.press(getByLabelText('Continue'))
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(onboarding)/consent',
      params: { name: '', age: '', city: 'Luzern' },
    })
  })
})
