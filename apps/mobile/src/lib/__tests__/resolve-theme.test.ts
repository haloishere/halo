import { describe, it, expect } from 'vitest'
import { resolveTheme } from '../resolve-theme'

describe('resolveTheme', () => {
  it('returns light when mode is light', () => {
    expect(resolveTheme('light', 'dark')).toBe('light')
  })

  it('returns dark when mode is dark', () => {
    expect(resolveTheme('dark', 'light')).toBe('dark')
  })

  it('returns dark when mode is system and colorScheme is dark', () => {
    expect(resolveTheme('system', 'dark')).toBe('dark')
  })

  it('returns light when mode is system and colorScheme is light', () => {
    expect(resolveTheme('system', 'light')).toBe('light')
  })

  it('returns light when mode is system and colorScheme is null', () => {
    expect(resolveTheme('system', null)).toBe('light')
  })
})
