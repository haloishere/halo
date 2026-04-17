import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '../../../test/render'
import { Chip } from '../Chip'

describe('Chip — rendering', () => {
  it('renders label text', () => {
    const { getByText } = render(<Chip label="Test" selected={false} onPress={() => {}} />)
    expect(getByText('Test')).toBeTruthy()
  })

  it('has accessibilityRole="checkbox"', () => {
    const { getByRole } = render(<Chip label="Check" selected={false} onPress={() => {}} />)
    expect(getByRole('checkbox')).toBeTruthy()
  })
})

describe('Chip — interaction', () => {
  it('calls onPress', () => {
    const onPress = vi.fn()
    const { getByRole } = render(<Chip label="Tap" selected={false} onPress={onPress} />)
    fireEvent.press(getByRole('checkbox'))
    expect(onPress).toHaveBeenCalledOnce()
  })
})

describe('Chip — accessibility', () => {
  it('has accessibilityState.checked=true when selected', () => {
    const { getByRole } = render(<Chip label="On" selected={true} onPress={() => {}} />)
    expect(getByRole('checkbox').props.accessibilityState?.checked).toBe(true)
  })

  it('has accessibilityState.checked=false when not selected', () => {
    const { getByRole } = render(<Chip label="Off" selected={false} onPress={() => {}} />)
    expect(getByRole('checkbox').props.accessibilityState?.checked).toBe(false)
  })
})
