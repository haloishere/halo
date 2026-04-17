import { describe, it, expect, vi } from 'vitest'

const babelConfig = require('./babel.config.js')

describe('Babel Configuration', () => {
  const api = { cache: vi.fn() }
  const config = babelConfig(api)

  it('uses babel-preset-expo', () => {
    expect(config.presets).toContain('babel-preset-expo')
  })

  it('includes @tamagui/babel-plugin', () => {
    const tamaguiPlugin = config.plugins.find((p: unknown) =>
      Array.isArray(p) ? p[0] === '@tamagui/babel-plugin' : p === '@tamagui/babel-plugin',
    )
    expect(tamaguiPlugin).toBeDefined()
  })

  it('includes react-native-reanimated/plugin', () => {
    const reanimatedPlugin = config.plugins.find((p: unknown) =>
      Array.isArray(p)
        ? p[0] === 'react-native-reanimated/plugin'
        : p === 'react-native-reanimated/plugin',
    )
    expect(reanimatedPlugin).toBeDefined()
  })

  it('has react-native-reanimated/plugin as the LAST plugin', () => {
    const lastPlugin = config.plugins[config.plugins.length - 1]
    const lastPluginName = Array.isArray(lastPlugin) ? lastPlugin[0] : lastPlugin
    expect(lastPluginName).toBe('react-native-reanimated/plugin')
  })
})
