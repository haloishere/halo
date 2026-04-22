import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '../../../test/render'
import { ProposalReviewRow } from '../ProposalReviewRow'
import type { MemoryProposal } from '@halo/shared'

const PROPOSAL: MemoryProposal = {
  topic: 'food_and_restaurants',
  label: 'vegetarian',
  value: 'Follows a vegetarian diet',
}

describe('ProposalReviewRow — rendering', () => {
  it('renders the proposal label and value', () => {
    const { getByText } = render(
      <ProposalReviewRow proposal={PROPOSAL} selected onToggle={vi.fn()} />,
    )
    expect(getByText('vegetarian')).toBeTruthy()
    expect(getByText('Follows a vegetarian diet')).toBeTruthy()
  })

  it('accessibility label includes the proposal label', () => {
    const { getByLabelText } = render(
      <ProposalReviewRow proposal={PROPOSAL} selected={false} onToggle={vi.fn()} />,
    )
    expect(getByLabelText('vegetarian memory proposal')).toBeTruthy()
  })
})

describe('ProposalReviewRow — toggle interaction', () => {
  it('calls onToggle(true) when Save is pressed while unselected', () => {
    const onToggle = vi.fn()
    const { getByLabelText } = render(
      <ProposalReviewRow proposal={PROPOSAL} selected={false} onToggle={onToggle} />,
    )
    fireEvent.press(getByLabelText('Save vegetarian'))
    expect(onToggle).toHaveBeenCalledWith(true)
  })

  it('calls onToggle(false) when Skip is pressed while selected', () => {
    const onToggle = vi.fn()
    const { getByLabelText } = render(
      <ProposalReviewRow proposal={PROPOSAL} selected={true} onToggle={onToggle} />,
    )
    fireEvent.press(getByLabelText('Skip vegetarian'))
    expect(onToggle).toHaveBeenCalledWith(false)
  })

  it('shows "Save" button when unselected and "Skip" when selected', () => {
    const { getByLabelText, rerender } = render(
      <ProposalReviewRow proposal={PROPOSAL} selected={false} onToggle={vi.fn()} />,
    )
    expect(getByLabelText('Save vegetarian')).toBeTruthy()

    rerender(<ProposalReviewRow proposal={PROPOSAL} selected={true} onToggle={vi.fn()} />)
    expect(getByLabelText('Skip vegetarian')).toBeTruthy()
  })
})
