import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '../../../src/test/render'

const { mockPush } = vi.hoisted(() => ({ mockPush: vi.fn() }))

vi.mock('expo-router', () => ({
  router: { push: mockPush },
  useLocalSearchParams: vi.fn().mockReturnValue({ name: 'Alice' }),
}))

import RelationshipScreen from '../relationship'

beforeEach(() => {
  mockPush.mockReset()
})

describe('RelationshipScreen — rendering', () => {
  it('renders all 5 relationship options', () => {
    const { getByText } = render(<RelationshipScreen />)
    expect(getByText('Spouse / Partner')).toBeTruthy()
    expect(getByText('Adult Child')).toBeTruthy()
    expect(getByText('Sibling')).toBeTruthy()
    expect(getByText('Professional Caregiver')).toBeTruthy()
    expect(getByText('Other')).toBeTruthy()
  })

  it('Continue button disabled when nothing selected', () => {
    const { getByLabelText } = render(<RelationshipScreen />)
    expect(getByLabelText('Continue').props.accessibilityState?.disabled).toBe(true)
  })
})

describe('RelationshipScreen — selection', () => {
  it('selects an option on press', () => {
    const { getByText, getAllByRole } = render(<RelationshipScreen />)
    fireEvent.press(getByText('Adult Child'))
    const radios = getAllByRole('radio')
    const selectedRadio = radios.find((r) => r.props.accessibilityState?.selected)
    expect(selectedRadio).toBeTruthy()
  })

  it('enables Continue after selection', () => {
    const { getByText, getByLabelText } = render(<RelationshipScreen />)
    fireEvent.press(getByText('Sibling'))
    expect(getByLabelText('Continue').props.accessibilityState?.disabled).toBe(false)
  })

  it('is single-select — only last pressed option remains selected', () => {
    const { getAllByRole } = render(<RelationshipScreen />)
    const options = getAllByRole('radio')
    fireEvent.press(options[0])
    fireEvent.press(options[1])
    const selectedCount = options.filter((o) => o.props.accessibilityState?.selected).length
    expect(selectedCount).toBe(1)
  })
})

describe('RelationshipScreen — navigation', () => {
  it('pushes to diagnosis with name and relationship params', () => {
    const { getByText, getByLabelText } = render(<RelationshipScreen />)
    fireEvent.press(getByText('Adult Child'))
    fireEvent.press(getByLabelText('Continue'))
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(onboarding)/diagnosis',
      params: { name: 'Alice', relationship: 'child' },
    })
  })
})
