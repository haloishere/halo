import { describe, it, expect } from 'vitest'
import tamaguiConfig from '../../tamagui.config'

/** Helper: extract the raw color string from a Tamagui theme value (Variable or string). */
function themeVal(value: unknown): string {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && 'val' in value)
    return String((value as { val: unknown }).val)
  return String(value)
}

/** Extract approximate lightness (0–1) from a Tamagui HSLA string like "hsla(60, 17%, 98%, 1)". */
function parseLightness(hsla: string): number {
  const match = hsla.match(/hsla?\([^,]+,\s*[^,]+,\s*(\d+)%/)
  return match ? parseInt(match[1], 10) / 100 : -1
}

describe('Tamagui App Configuration', () => {
  it('config is defined', () => {
    expect(tamaguiConfig).toBeDefined()
  })

  it('has light and dark themes', () => {
    expect(tamaguiConfig.themes).toHaveProperty('light')
    expect(tamaguiConfig.themes).toHaveProperty('dark')
  })

  it('has design tokens (space, size, radius)', () => {
    expect(tamaguiConfig.tokens).toBeDefined()
    expect(tamaguiConfig.tokens.space).toBeDefined()
    expect(tamaguiConfig.tokens.size).toBeDefined()
    expect(tamaguiConfig.tokens.radius).toBeDefined()
  })

  it('has font config', () => {
    expect(tamaguiConfig.fonts).toBeDefined()
  })
})

describe('Theme palette correctness', () => {
  const { themes } = tamaguiConfig

  it('light theme has light background and dark foreground', () => {
    const light = themes.light as Record<string, unknown>
    const bgVal = themeVal(light.background)
    const fgVal = themeVal(light.color)
    // Light background should be bright (>90%), foreground should be dark (<15%).
    expect(parseLightness(bgVal)).toBeGreaterThan(0.9)
    expect(parseLightness(fgVal)).toBeLessThan(0.15)
  })

  it('dark theme inverts background and foreground', () => {
    const dark = themes.dark as Record<string, unknown>
    const bgVal = themeVal(dark.background)
    const fgVal = themeVal(dark.color)
    // Dark background should be dark (<15%), foreground should be bright (>90%).
    expect(parseLightness(bgVal)).toBeLessThan(0.15)
    expect(parseLightness(fgVal)).toBeGreaterThan(0.9)
  })
})

describe('Accent tokens on base themes', () => {
  const { themes } = tamaguiConfig

  it('light theme has accent1 through accent12', () => {
    const light = themes.light as Record<string, unknown>
    for (let i = 1; i <= 12; i++) {
      expect(light).toHaveProperty(`accent${i}`)
      expect(themeVal(light[`accent${i}`])).toMatch(/^hsla?\(/)
    }
  })

  it('dark theme has accent1 through accent12', () => {
    const dark = themes.dark as Record<string, unknown>
    for (let i = 1; i <= 12; i++) {
      expect(dark).toHaveProperty(`accent${i}`)
      expect(themeVal(dark[`accent${i}`])).toMatch(/^hsla?\(/)
    }
  })

  it('light accent values use the Royal Navy Blue palette (hue 215–230)', () => {
    const light = themes.light as Record<string, unknown>
    // Verify accent tokens span the royal-navy blue hue range
    const accent1Hue = parseInt(themeVal(light.accent1).match(/hsla?\((\d+)/)?.[1] ?? '0', 10)
    const accent9Hue = parseInt(themeVal(light.accent9).match(/hsla?\((\d+)/)?.[1] ?? '0', 10)
    expect(accent1Hue).toBeGreaterThanOrEqual(215)
    expect(accent1Hue).toBeLessThanOrEqual(225)
    expect(accent9Hue).toBeGreaterThanOrEqual(218)
    expect(accent9Hue).toBeLessThanOrEqual(230)
  })

  it('dark accent values use the dark Royal Navy Blue palette (hue 215–230)', () => {
    const dark = themes.dark as Record<string, unknown>
    const accent1Hue = parseInt(themeVal(dark.accent1).match(/hsla?\((\d+)/)?.[1] ?? '0', 10)
    const accent9Hue = parseInt(themeVal(dark.accent9).match(/hsla?\((\d+)/)?.[1] ?? '0', 10)
    expect(accent1Hue).toBeGreaterThanOrEqual(215)
    expect(accent1Hue).toBeLessThanOrEqual(225)
    expect(accent9Hue).toBeGreaterThanOrEqual(218)
    expect(accent9Hue).toBeLessThanOrEqual(230)
  })
})

describe('Accent sub-themes', () => {
  const { themes } = tamaguiConfig

  it('accent sub-themes exist for light and dark', () => {
    expect(themes).toHaveProperty('light_accent')
    expect(themes).toHaveProperty('dark_accent')
  })
})

describe('Children sub-themes', () => {
  const { themes } = tamaguiConfig

  it('warning sub-themes exist for light and dark', () => {
    expect(themes).toHaveProperty('light_warning')
    expect(themes).toHaveProperty('dark_warning')
  })

  it('error sub-themes exist for light and dark', () => {
    expect(themes).toHaveProperty('light_error')
    expect(themes).toHaveProperty('dark_error')
  })

  it('success sub-themes exist for light and dark', () => {
    expect(themes).toHaveProperty('light_success')
    expect(themes).toHaveProperty('dark_success')
  })
})
