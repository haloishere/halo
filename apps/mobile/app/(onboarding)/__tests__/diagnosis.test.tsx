import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '../../../src/test/render'

const { mockPush } = vi.hoisted(() => ({ mockPush: vi.fn() }))

vi.mock('expo-router', () => ({
  router: { push: mockPush },
  useLocalSearchParams: vi.fn().mockReturnValue({ name: 'Alice', relationship: 'child' }),
}))

import DiagnosisScreen from '../diagnosis'

beforeEach(() => {
  mockPush.mockReset()
})

describe('DiagnosisScreen — rendering', () => {
  it('renders all 4 diagnosis stages', { timeout: 15000 }, () => {
    const { getByText } = render(<DiagnosisScreen />)
    expect(getByText('Early stage')).toBeTruthy()
    expect(getByText('Middle stage')).toBeTruthy()
    expect(getByText('Late stage')).toBeTruthy()
    expect(getByText('Not sure')).toBeTruthy()
  })

  it('Continue button disabled when nothing selected', () => {
    const { getByLabelText } = render(<DiagnosisScreen />)
    expect(getByLabelText('Continue').props.accessibilityState?.disabled).toBe(true)
  })
})

describe('DiagnosisScreen — selection', () => {
  it('enables Continue after selecting a stage', () => {
    const { getByText, getByLabelText } = render(<DiagnosisScreen />)
    fireEvent.press(getByText('Middle stage'))
    expect(getByLabelText('Continue').props.accessibilityState?.disabled).toBe(false)
  })

  it('is single-select — only one stage selected at a time', () => {
    const { getAllByRole } = render(<DiagnosisScreen />)
    const options = getAllByRole('radio')
    fireEvent.press(options[0])
    fireEvent.press(options[2])
    const selectedCount = options.filter((o) => o.props.accessibilityState?.selected).length
    expect(selectedCount).toBe(1)
  })
})

describe('DiagnosisScreen — navigation', () => {
  it('pushes to challenges with all 3 params', () => {
    const { getByText, getByLabelText } = render(<DiagnosisScreen />)
    fireEvent.press(getByText('Early stage'))
    fireEvent.press(getByLabelText('Continue'))
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(onboarding)/challenges',
      params: { name: 'Alice', relationship: 'child', diagnosisStage: 'early' },
    })
  })

  it('does not navigate when nothing is selected', () => {
    const { getByLabelText } = render(<DiagnosisScreen />)
    fireEvent.press(getByLabelText('Continue'))
    expect(mockPush).not.toHaveBeenCalled()
  })
})
