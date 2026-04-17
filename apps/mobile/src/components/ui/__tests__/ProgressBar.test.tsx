import React from 'react'
import { describe, it, expect } from 'vitest'
import { render } from '../../../test/render'
import { ProgressBar } from '../ProgressBar'

describe('ProgressBar', () => {
  it('renders "Step X of Y" text', () => {
    const { getByText } = render(<ProgressBar currentStep={2} totalSteps={4} />)
    expect(getByText('Step 2 of 4')).toBeTruthy()
  })

  it('renders Progress component', () => {
    const { toJSON } = render(<ProgressBar currentStep={1} totalSteps={3} />)
    expect(toJSON()).toBeTruthy()
  })

  it('handles totalSteps=0 without crashing', () => {
    const { getByText, toJSON } = render(<ProgressBar currentStep={0} totalSteps={0} />)
    expect(getByText('Step 0 of 0')).toBeTruthy()
    expect(toJSON()).toBeTruthy()
  })
})
