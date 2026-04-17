import { describe, it, expect } from 'vitest'
import easConfig from './eas.json'

describe('EAS Configuration', () => {
  it('has all required build profiles', () => {
    expect(easConfig.build).toHaveProperty('development')
    expect(easConfig.build).toHaveProperty('e2e')
    expect(easConfig.build).toHaveProperty('preview')
    expect(easConfig.build).toHaveProperty('production')
  })

  it('e2e profile uses simulator without dev client', () => {
    expect(easConfig.build.e2e.distribution).toBe('internal')
    expect(easConfig.build.e2e.ios.simulator).toBe(true)
    expect(easConfig.build.e2e).not.toHaveProperty('developmentClient')
  })

  it('development profile uses internal distribution with dev client', () => {
    expect(easConfig.build.development.distribution).toBe('internal')
    expect(easConfig.build.development.developmentClient).toBe(true)
  })

  it('preview profile uses internal distribution', () => {
    expect(easConfig.build.preview.distribution).toBe('internal')
  })

  it('production profile uses store distribution', () => {
    expect(easConfig.build.production.distribution).toBe('store')
  })

  it('has correct CLI version requirement', () => {
    expect(easConfig.cli.version).toBeDefined()
    expect(easConfig.cli.version).toMatch(/>=\d+\.\d+\.\d+/)
  })

  it('development iOS profile enables simulator', () => {
    expect(easConfig.build.development.ios.simulator).toBe(true)
  })

  it('each profile has API URL configured', () => {
    expect(easConfig.build.development.env.EXPO_PUBLIC_API_URL).toBeDefined()
    expect(easConfig.build.preview.env.EXPO_PUBLIC_API_URL).toBeDefined()
    expect(easConfig.build.production.env.EXPO_PUBLIC_API_URL).toBeDefined()
  })

  it('production API URL points to halo.life domain', () => {
    expect(easConfig.build.production.env.EXPO_PUBLIC_API_URL).toContain('halo.life')
  })

  it('development API URL points to staging', () => {
    expect(easConfig.build.development.env.EXPO_PUBLIC_API_URL).toContain('api-staging.halo.life')
  })
})
