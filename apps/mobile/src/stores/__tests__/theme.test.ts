import { describe, it, expect, beforeEach } from 'vitest'
import { useThemeStore } from '../theme'

beforeEach(() => {
  useThemeStore.setState({ mode: 'system' })
})

describe('useThemeStore', () => {
  it('defaults to system mode', () => {
    expect(useThemeStore.getState().mode).toBe('system')
  })

  it('setMode to dark', () => {
    useThemeStore.getState().setMode('dark')
    expect(useThemeStore.getState().mode).toBe('dark')
  })

  it('setMode to light', () => {
    useThemeStore.getState().setMode('light')
    expect(useThemeStore.getState().mode).toBe('light')
  })

  it('setMode back to system', () => {
    useThemeStore.getState().setMode('dark')
    useThemeStore.getState().setMode('system')
    expect(useThemeStore.getState().mode).toBe('system')
  })
})
