import { describe, it, expect, vi, beforeAll } from 'vitest'
import path from 'path'
import fs from 'fs'

vi.mock('expo/metro-config', () => ({
  getDefaultConfig: vi.fn(() => ({
    watchFolders: [],
    resolver: {
      nodeModulesPaths: [],
      resolverMainFields: [],
    },
  })),
}))

// metro.config.js is CJS that requires expo/metro-config (mocked above).
// Import it ONCE for the happy-path assertions, avoiding repeated Vite SSR
// re-resolution which is slow when the full suite has loaded Tamagui/RN modules.

describe('Metro Configuration', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let config: any

  beforeAll(async () => {
    const mod = await import('./metro.config.js')
    config = mod.default
  }, 60_000) // Full suite warms heavy RN/Tamagui module graph; allow extra time

  it('exports valid config with watchFolders and resolver', () => {
    expect(config).toHaveProperty('watchFolders')
    expect(config).toHaveProperty('resolver')
  })

  it('watchFolders includes monorepo root', () => {
    const monorepoRoot = path.resolve(__dirname, '../..')
    expect(config.watchFolders).toContain(monorepoRoot)
  })

  it('nodeModulesPaths includes both local and root node_modules', () => {
    const localModules = path.resolve(__dirname, 'node_modules')
    const rootModules = path.resolve(__dirname, '../../node_modules')
    expect(config.resolver.nodeModulesPaths).toContain(localModules)
    expect(config.resolver.nodeModulesPaths).toContain(rootModules)
  })

  it('resolverMainFields prioritizes react-native', () => {
    expect(config.resolver.resolverMainFields).toEqual(['react-native', 'browser', 'main'])
  })

  describe('resolveRequest React singleton', () => {
    it('redirects exact "react" import to app workspace copy', () => {
      const resolveRequest = config.resolver.resolveRequest
      const result = resolveRequest({}, 'react', 'android')
      expect(result).toEqual({ type: 'sourceFile', filePath: expect.stringContaining('/react/') })
    })

    it('redirects "react/jsx-runtime" sub-path to app workspace copy', () => {
      const resolveRequest = config.resolver.resolveRequest
      const result = resolveRequest({}, 'react/jsx-runtime', 'android')
      expect(result).toEqual({
        type: 'sourceFile',
        filePath: expect.stringContaining('/react/jsx-runtime'),
      })
    })

    it('redirects "react/jsx-dev-runtime" sub-path to app workspace copy', () => {
      const resolveRequest = config.resolver.resolveRequest
      const result = resolveRequest({}, 'react/jsx-dev-runtime', 'android')
      expect(result).toEqual({
        type: 'sourceFile',
        filePath: expect.stringContaining('/react/jsx-dev-runtime'),
      })
    })

    it('does NOT redirect react-native (native module)', () => {
      const mockContext = {
        resolveRequest: vi.fn(() => ({ type: 'sourceFile', filePath: '/mock/react-native' })),
      }
      const resolveRequest = config.resolver.resolveRequest
      resolveRequest(mockContext, 'react-native', 'android')
      expect(mockContext.resolveRequest).toHaveBeenCalled()
    })

    it('does NOT redirect react-native-reanimated', () => {
      const mockContext = {
        resolveRequest: vi.fn(() => ({ type: 'sourceFile', filePath: '/mock/reanimated' })),
      }
      const resolveRequest = config.resolver.resolveRequest
      resolveRequest(mockContext, 'react-native-reanimated', 'android')
      expect(mockContext.resolveRequest).toHaveBeenCalled()
    })

    it('falls back gracefully when react sub-path does not exist', () => {
      const mockContext = {
        resolveRequest: vi.fn(() => ({ type: 'sourceFile', filePath: '/fallback' })),
      }
      const resolveRequest = config.resolver.resolveRequest
      // Should not crash — falls through to context.resolveRequest
      const result = resolveRequest(mockContext, 'react/nonexistent-entry', 'android')
      expect(result).toBeDefined()
      expect(mockContext.resolveRequest).toHaveBeenCalled()
    })
  })

  it('throws when pnpm-workspace.yaml is missing at monorepo root', async () => {
    vi.resetModules()
    const originalExistsSync = fs.existsSync
    vi.spyOn(fs, 'existsSync').mockImplementation((p: fs.PathLike) => {
      if (typeof p === 'string' && p.endsWith('pnpm-workspace.yaml')) return false
      return originalExistsSync(p)
    })
    await expect(async () => import('./metro.config.js')).rejects.toThrow('pnpm-workspace.yaml')
    vi.restoreAllMocks()
  })
})
