import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '../../../test/render'
import { ConfirmDialog } from '../ConfirmDialog'

let defaultProps: {
  open: boolean
  onOpenChange: ReturnType<typeof vi.fn>
  title: string
  description: string
  confirmLabel: string
  onConfirm: ReturnType<typeof vi.fn>
}

beforeEach(() => {
  defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    title: 'Delete Chat',
    description: 'Are you sure?',
    confirmLabel: 'Delete',
    onConfirm: vi.fn(),
  }
})

describe('ConfirmDialog — rendering', () => {
  it('renders title and description when open', () => {
    const { getByText } = render(<ConfirmDialog {...defaultProps} />)
    expect(getByText('Delete Chat')).toBeTruthy()
    expect(getByText('Are you sure?')).toBeTruthy()
  })

  it('does not render content when open is false', () => {
    const { queryByText } = render(<ConfirmDialog {...defaultProps} open={false} />)
    expect(queryByText('Delete Chat')).toBeNull()
  })

  it('renders confirm button with provided label', () => {
    const { getByText } = render(<ConfirmDialog {...defaultProps} confirmLabel="Remove" />)
    expect(getByText('Remove')).toBeTruthy()
  })

  it('renders cancel button with default label', () => {
    const { getByText } = render(<ConfirmDialog {...defaultProps} />)
    expect(getByText('Cancel')).toBeTruthy()
  })

  it('renders cancel button with custom label', () => {
    const { getByText } = render(<ConfirmDialog {...defaultProps} cancelLabel="Never mind" />)
    expect(getByText('Never mind')).toBeTruthy()
  })
})

describe('ConfirmDialog — interaction', () => {
  it('calls onOpenChange(false) when cancel is pressed', () => {
    const { getByText } = render(<ConfirmDialog {...defaultProps} />)
    fireEvent.press(getByText('Cancel'))
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false)
  })

  it('calls onConfirm without closing when confirm is pressed', () => {
    const { getByText } = render(<ConfirmDialog {...defaultProps} />)
    fireEvent.press(getByText('Delete'))
    expect(defaultProps.onConfirm).toHaveBeenCalledOnce()
    expect(defaultProps.onOpenChange).not.toHaveBeenCalled()
  })

  it('calls onOpenChange(false) when backdrop is pressed', () => {
    const { getByTestId } = render(<ConfirmDialog {...defaultProps} />)
    fireEvent.press(getByTestId('confirm-dialog-overlay'))
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false)
  })

  it('does not dismiss on backdrop press while loading', () => {
    const { getByTestId } = render(<ConfirmDialog {...defaultProps} loading />)
    fireEvent.press(getByTestId('confirm-dialog-overlay'))
    expect(defaultProps.onOpenChange).not.toHaveBeenCalled()
  })
})

describe('ConfirmDialog — loading state', () => {
  it('marks cancel button as disabled while loading', () => {
    const { getByLabelText } = render(<ConfirmDialog {...defaultProps} loading />)
    const cancel = getByLabelText('Cancel')
    expect(cancel.props.accessibilityState?.disabled ?? cancel.props.disabled).toBeTruthy()
  })

  it('marks confirm button as disabled while loading', () => {
    const { getByLabelText } = render(<ConfirmDialog {...defaultProps} loading />)
    const confirm = getByLabelText('Delete')
    expect(confirm.props.accessibilityState?.disabled ?? confirm.props.disabled).toBeTruthy()
  })
})

describe('ConfirmDialog — accessibility', () => {
  it('has alert role on dialog container', () => {
    const { getByRole } = render(<ConfirmDialog {...defaultProps} />)
    expect(getByRole('alert')).toBeTruthy()
  })

  it('has accessible label matching title', () => {
    const { getByLabelText } = render(<ConfirmDialog {...defaultProps} />)
    expect(getByLabelText('Delete Chat')).toBeTruthy()
  })

  it('has accessible labels on buttons', () => {
    const { getByLabelText } = render(<ConfirmDialog {...defaultProps} />)
    expect(getByLabelText('Cancel')).toBeTruthy()
    expect(getByLabelText('Delete')).toBeTruthy()
  })
})
