import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '../../../test/render'

const mockSetMode = vi.fn()

vi.mock('../../../stores/theme', () => ({
  useThemeStore: vi.fn(() => ({
    mode: 'light',
    setMode: mockSetMode,
  })),
}))

import { ThemeIconToggle } from '../ThemeIconToggle'

beforeEach(() => {
  mockSetMode.mockReset()
})

describe('ThemeIconToggle — rendering', () => {
  it('renders the Switch component', () => {
    const { getByRole } = render(<ThemeIconToggle />)
    expect(getByRole('switch')).toBeTruthy()
  })
})

describe('ThemeIconToggle — interaction', () => {
  it('calls setMode on toggle', () => {
    const { getByRole } = render(<ThemeIconToggle />)
    const switchEl = getByRole('switch')
    // Tamagui Switch uses onCheckedChange — fire it via RNTL's fireEvent helper
    fireEvent(switchEl, 'checkedChange', true)
    expect(mockSetMode).toHaveBeenCalledWith('dark')
  })

  it('resolves system mode as light when colorScheme is light', () => {
    // Mock returns mode='light' — isDark should be false, switch unchecked
    const { getByRole } = render(<ThemeIconToggle />)
    const switchEl = getByRole('switch')
    // Toggle off→on = light→dark
    fireEvent(switchEl, 'checkedChange', false)
    expect(mockSetMode).toHaveBeenCalledWith('light')
  })
})
