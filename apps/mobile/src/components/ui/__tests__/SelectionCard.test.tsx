import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '../../../test/render'
import { SelectionCard } from '../SelectionCard'

describe('SelectionCard — rendering', () => {
  it('renders title text', () => {
    const { getByText } = render(
      <SelectionCard title="Option A" selected={false} onPress={() => {}} />,
    )
    expect(getByText('Option A')).toBeTruthy()
  })

  it('renders description when provided', () => {
    const { getByText } = render(
      <SelectionCard
        title="Option A"
        description="Details here"
        selected={false}
        onPress={() => {}}
      />,
    )
    expect(getByText('Details here')).toBeTruthy()
  })
})

describe('SelectionCard — interaction', () => {
  it('calls onPress', () => {
    const onPress = vi.fn()
    const { getByRole } = render(
      <SelectionCard title="Option A" selected={false} onPress={onPress} />,
    )
    fireEvent.press(getByRole('radio'))
    expect(onPress).toHaveBeenCalledOnce()
  })
})

describe('SelectionCard — accessibility', () => {
  it('has accessibilityState.selected matching selected prop', () => {
    const { getByRole } = render(
      <SelectionCard title="Option A" selected={true} onPress={() => {}} />,
    )
    expect(getByRole('radio').props.accessibilityState?.selected).toBe(true)
  })

  it('defaults to accessibilityRole="radio"', () => {
    const { getByRole } = render(
      <SelectionCard title="Option A" selected={false} onPress={() => {}} />,
    )
    expect(getByRole('radio')).toBeTruthy()
  })
})
