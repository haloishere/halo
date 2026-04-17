import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, act } from '../../../test/render'
import { OtpInput } from '../OtpInput'

describe('OtpInput — rendering', () => {
  it('renders 6 input cells', () => {
    const { getAllByLabelText } = render(<OtpInput onComplete={vi.fn()} />)
    const cells = getAllByLabelText(/digit \d/)
    expect(cells).toHaveLength(6)
  })

  it('renders with error message when error prop set', () => {
    const { getByText } = render(<OtpInput onComplete={vi.fn()} error="Invalid code" />)
    expect(getByText('Invalid code')).toBeTruthy()
  })

  it('does not render error when not set', () => {
    const { queryByText } = render(<OtpInput onComplete={vi.fn()} />)
    expect(queryByText('Invalid code')).toBeNull()
  })
})

describe('OtpInput — interaction', () => {
  it('calls onComplete when all 6 digits entered', async () => {
    const onComplete = vi.fn()
    const { getAllByLabelText } = render(<OtpInput onComplete={onComplete} />)
    const cells = getAllByLabelText(/digit \d/)

    // Simulate typing each digit
    for (let i = 0; i < 6; i++) {
      fireEvent.changeText(cells[i]!, String(i + 1))
    }

    // onComplete is deferred via setTimeout(0) — flush with act
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })

    expect(onComplete).toHaveBeenCalledWith('123456')
  })

  it('rejects non-numeric input', () => {
    const onComplete = vi.fn()
    const { getAllByLabelText } = render(<OtpInput onComplete={onComplete} />)
    const cells = getAllByLabelText(/digit \d/)

    // Try entering a letter
    fireEvent.changeText(cells[0]!, 'a')

    // Should not advance — onComplete should not be called
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('handles paste of full 6-digit code', () => {
    const onComplete = vi.fn()
    const { getAllByLabelText } = render(<OtpInput onComplete={onComplete} />)
    const cells = getAllByLabelText(/digit \d/)

    // Simulate pasting a 6-digit code into the first cell
    fireEvent.changeText(cells[0]!, '654321')

    expect(onComplete).toHaveBeenCalledWith('654321')
  })
})
