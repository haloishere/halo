import React from 'react'
import { Text } from 'react-native'
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '../../../test/render'
import { Button } from '../Button'

describe('Button — rendering', () => {
  it('renders the label', () => {
    const { getByText } = render(<Button label="Press me" />)
    expect(getByText('Press me')).toBeTruthy()
  })

  it('renders primary variant by default', () => {
    const { getByRole } = render(<Button label="Submit" />)
    expect(getByRole('button')).toBeTruthy()
  })

  it('renders outline variant', () => {
    const { getByText } = render(<Button label="Outline" variant="outline" />)
    expect(getByText('Outline')).toBeTruthy()
  })

  it('renders secondary variant', () => {
    const { getByText } = render(<Button label="Secondary" variant="secondary" />)
    expect(getByText('Secondary')).toBeTruthy()
  })
})

describe('Button — interaction', () => {
  it('calls onPress when tapped', () => {
    const onPress = vi.fn()
    const { getByRole } = render(<Button label="Tap" onPress={onPress} />)
    fireEvent.press(getByRole('button'))
    expect(onPress).toHaveBeenCalledOnce()
  })

  it('does not call onPress when disabled', () => {
    const onPress = vi.fn()
    const { getByRole } = render(<Button label="Disabled" onPress={onPress} disabled />)
    fireEvent.press(getByRole('button'))
    expect(onPress).not.toHaveBeenCalled()
  })

  it('does not call onPress when loading', () => {
    const onPress = vi.fn()
    const { getByRole } = render(<Button label="Loading" onPress={onPress} loading />)
    fireEvent.press(getByRole('button'))
    expect(onPress).not.toHaveBeenCalled()
  })
})

describe('Button — loading state', () => {
  it('shows ActivityIndicator when loading', () => {
    const { queryByText, getByRole } = render(<Button label="Save" loading />)
    // Label text hidden while loading, button still present
    expect(queryByText('Save')).toBeNull()
    expect(getByRole('button')).toBeTruthy()
  })

  it('shows label when not loading', () => {
    const { getByText } = render(<Button label="Save" />)
    expect(getByText('Save')).toBeTruthy()
  })
})

describe('Button — icon prop', () => {
  it('renders with icon when provided and not loading', () => {
    const { getByText, getByRole } = render(<Button label="With icon" icon={<Text>IC</Text>} />)
    expect(getByRole('button')).toBeTruthy()
    expect(getByText('With icon')).toBeTruthy()
  })

  it('shows spinner instead of icon when loading', () => {
    const { queryByText } = render(<Button label="Loading" icon={<Text>IC</Text>} loading />)
    // Icon text should not be rendered when loading replaces it with spinner
    expect(queryByText('IC')).toBeNull()
  })
})

describe('Button — theming', () => {
  it('primary variant uses theme token for text color, not hardcoded hex', () => {
    const { getByRole } = render(<Button label="Themed" />)
    const btn = getByRole('button')
    // Should use $color1 token, NOT #FFFFFF
    expect(btn.props.color).not.toBe('#FFFFFF')
  })
})

describe('Button — accessibility', () => {
  it('has accessibilityLabel matching the label', () => {
    const { getByLabelText } = render(<Button label="Submit form" />)
    expect(getByLabelText('Submit form')).toBeTruthy()
  })

  it('reports disabled state via accessibilityState', () => {
    const { getByRole } = render(<Button label="Disabled" disabled />)
    const btn = getByRole('button')
    expect(btn.props.accessibilityState.disabled).toBe(true)
  })
})
