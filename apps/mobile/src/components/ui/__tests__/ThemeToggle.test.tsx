import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '../../../test/render'

const mockSetMode = vi.fn()

vi.mock('../../../stores/theme', () => ({
  useThemeStore: vi.fn(() => ({
    mode: 'system',
    setMode: mockSetMode,
  })),
}))

import { ThemeToggle } from '../ThemeToggle'

beforeEach(() => {
  mockSetMode.mockReset()
})

describe('ThemeToggle — rendering', () => {
  it('renders System/Light/Dark options', () => {
    const { getByText } = render(<ThemeToggle />)
    expect(getByText('System')).toBeTruthy()
    expect(getByText('Light')).toBeTruthy()
    expect(getByText('Dark')).toBeTruthy()
  })
})

describe('ThemeToggle — interaction', () => {
  it('calls setMode("dark") on Dark press', () => {
    const { getByLabelText } = render(<ThemeToggle />)
    fireEvent.press(getByLabelText('Dark theme'))
    expect(mockSetMode).toHaveBeenCalledWith('dark')
  })

  it('calls setMode("light") on Light press', () => {
    const { getByLabelText } = render(<ThemeToggle />)
    fireEvent.press(getByLabelText('Light theme'))
    expect(mockSetMode).toHaveBeenCalledWith('light')
  })

  it('calls setMode("system") on System press', () => {
    const { getByLabelText } = render(<ThemeToggle />)
    fireEvent.press(getByLabelText('System theme'))
    expect(mockSetMode).toHaveBeenCalledWith('system')
  })
})
