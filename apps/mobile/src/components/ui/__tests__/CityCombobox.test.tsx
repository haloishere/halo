import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Keyboard } from 'react-native'
import { render, fireEvent, act } from '../../../test/render'
import { CityCombobox } from '../CityCombobox'

// Tamagui's Input handler reads `e.target.value` on focus/blur — pass a
// synthetic event with the expected shape so the handler doesn't crash.
const FOCUS_EVENT = { nativeEvent: { target: 0 }, target: { value: '' } }

let dismissSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  dismissSpy = vi.spyOn(Keyboard, 'dismiss').mockImplementation(() => {})
  vi.useRealTimers()
})

afterEach(() => {
  dismissSpy.mockRestore()
})

describe('CityCombobox — rendering', () => {
  it('renders the input with the given placeholder', () => {
    const { getByLabelText } = render(
      <CityCombobox value="" onChangeText={() => {}} />,
    )
    expect(getByLabelText('City')).toBeTruthy()
  })

  it('does not show suggestions when value is empty', () => {
    const { queryByText } = render(<CityCombobox value="" onChangeText={() => {}} />)
    expect(queryByText('Luzern')).toBeNull()
  })

  it('does not show suggestions when input is unfocused', () => {
    const { queryByText } = render(<CityCombobox value="Luz" onChangeText={() => {}} />)
    // The list only opens after onFocus. Prior to focus, no rows should render.
    expect(queryByText('Luzern')).toBeNull()
  })
})

describe('CityCombobox — filtering', () => {
  it('shows prefix matches when focused', () => {
    const { getByLabelText, getByText } = render(
      <CityCombobox value="Luz" onChangeText={() => {}} />,
    )
    fireEvent(getByLabelText('City'), 'focus', FOCUS_EVENT)
    expect(getByText('Luzern')).toBeTruthy()
  })

  it('shows country alongside city name in suggestion row', () => {
    const { getByLabelText, getByText } = render(
      <CityCombobox value="Luz" onChangeText={() => {}} />,
    )
    fireEvent(getByLabelText('City'), 'focus', FOCUS_EVENT)
    expect(getByText('Switzerland')).toBeTruthy()
  })

  it('caps the suggestion list at 6 rows', () => {
    // "a" is a broad query that matches many cities by prefix.
    const { getByLabelText, queryAllByRole } = render(
      <CityCombobox value="a" onChangeText={() => {}} />,
    )
    fireEvent(getByLabelText('City'), 'focus', FOCUS_EVENT)
    // Each suggestion row has accessibilityRole="button".
    const rows = queryAllByRole('button')
    expect(rows.length).toBeLessThanOrEqual(6)
    expect(rows.length).toBeGreaterThan(0)
  })

  it('falls back to substring match when no prefix match exists', () => {
    // "uzer" is not a prefix of any city but is a substring of "Luzern".
    const { getByLabelText, getByText } = render(
      <CityCombobox value="uzer" onChangeText={() => {}} />,
    )
    fireEvent(getByLabelText('City'), 'focus', FOCUS_EVENT)
    expect(getByText('Luzern')).toBeTruthy()
  })
})

describe('CityCombobox — selection', () => {
  it('tapping a suggestion fills input with "City, Country"', () => {
    const onChangeText = vi.fn()
    const { getByLabelText } = render(
      <CityCombobox value="Luz" onChangeText={onChangeText} />,
    )
    fireEvent(getByLabelText('City'), 'focus', FOCUS_EVENT)
    fireEvent.press(getByLabelText('Luzern, Switzerland'))
    expect(onChangeText).toHaveBeenCalledWith('Luzern, Switzerland')
  })

  it('tapping a suggestion dismisses the keyboard', () => {
    const { getByLabelText } = render(
      <CityCombobox value="Luz" onChangeText={() => {}} />,
    )
    fireEvent(getByLabelText('City'), 'focus', FOCUS_EVENT)
    fireEvent.press(getByLabelText('Luzern, Switzerland'))
    expect(dismissSpy).toHaveBeenCalled()
  })
})

describe('CityCombobox — blur behaviour', () => {
  it('keeps the list open long enough for a suggestion tap', () => {
    vi.useFakeTimers()
    const onChangeText = vi.fn()
    const { getByLabelText } = render(
      <CityCombobox value="Luz" onChangeText={onChangeText} />,
    )
    fireEvent(getByLabelText('City'), 'focus', FOCUS_EVENT)
    // Blur fires first on tap; we simulate it then immediately press the row.
    fireEvent(getByLabelText('City'), 'blur', FOCUS_EVENT)
    fireEvent.press(getByLabelText('Luzern, Switzerland'))
    expect(onChangeText).toHaveBeenCalledWith('Luzern, Switzerland')
    vi.useRealTimers()
  })

  it('hides the list after the blur grace window expires', () => {
    vi.useFakeTimers()
    const { getByLabelText, queryByLabelText } = render(
      <CityCombobox value="Luz" onChangeText={() => {}} />,
    )
    fireEvent(getByLabelText('City'), 'focus', FOCUS_EVENT)
    expect(queryByLabelText('Luzern, Switzerland')).toBeTruthy()
    fireEvent(getByLabelText('City'), 'blur', FOCUS_EVENT)
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(queryByLabelText('Luzern, Switzerland')).toBeNull()
    vi.useRealTimers()
  })
})
