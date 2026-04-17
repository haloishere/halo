import { defineConfig, type Plugin } from 'vitest/config'
import { resolve } from 'path'

/**
 * React Native 0.81+ ships uncompiled source with Flow type annotations and
 * Hermes `component Foo(...)` syntax that Rollup/Vite cannot parse.
 *
 * This plugin intercepts react-native files in Vite's SSR transform pipeline
 * (enforce:'pre' ensures it runs before Rollup sees the raw Flow source).
 * A second transform hook in src/test/setup.ts handles the CJS require() path
 * via Module._extensions for the same reason.
 */
const reactNativeBabelPlugin: Plugin = {
  name: 'react-native-babel-transform',
  enforce: 'pre',
  async transform(code, id) {
    const isRNSource =
      id.includes('/react-native/') ||
      id.includes('/@react-native/') ||
      id.includes('/react-native-')
    if (!isRNSource) return null
    if (!id.endsWith('.js') && !id.endsWith('.jsx')) return null
    // Skip already-compiled files without Flow markers
    if (!code.includes('@flow') && !code.includes('component ') && !code.includes('import type')) {
      return null
    }

    const babel = await import('@babel/core')
    const result = await babel.transformAsync(code, {
      filename: id,
      babelrc: false,
      configFile: false,
      presets: [
        [
          '@react-native/babel-preset',
          // disableImportExportTransform:true keeps ESM imports intact for Vite's ESM pipeline
          { dev: false, enableBabelRuntime: false, disableImportExportTransform: true },
        ],
      ],
    })
    return result?.code != null ? { code: result.code, map: result.map ?? null } : null
  },
}

/**
 * Tamagui v2 RC native.cjs bundles a web-oriented View component that calls
 * createDOMProps → getCSSStylesAtomic(). In the native bundle, getCSSStylesAtomic
 * is a no-op that logs a warning and returns undefined. When a styled component
 * has inline styles (e.g. opacity:0.5 on disabled buttons), flattenStyle returns
 * truthy, getCSSStylesAtomic() returns undefined, and .reduce() crashes.
 *
 * This plugin patches the bundle at transform time: replacing the no-op with a
 * function that returns [] so the reduce() has an empty array to work with.
 */
const tamaguiCSSAtomicPatchPlugin: Plugin = {
  name: 'tamagui-css-atomic-patch',
  enforce: 'pre',
  transform(code, id) {
    if (!id.includes('tamagui/dist/')) return null
    if (!code.includes('getCSSStylesAtomic = empty')) return null
    return {
      code: code.replace(
        'getCSSStylesAtomic = empty, getStyleAtomic = empty',
        'getCSSStylesAtomic = function() { return [] }, getStyleAtomic = function() { return [] }',
      ),
      map: null,
    }
  },
}

export default defineConfig({
  plugins: [reactNativeBabelPlugin, tamaguiCSSAtomicPatchPlugin],
  // React 17+ "automatic" JSX runtime: esbuild injects react/jsx-runtime imports so
  // source files can use JSX without `import React from 'react'`.
  esbuild: {
    jsx: 'automatic',
  },
  // Mirror the react-native jest-preset's customExportConditions so Vite's ESM
  // resolver uses the 'react-native' export condition from package.json exports fields.
  // This aligns the ESM path with how the react-native Jest environment resolves modules.
  resolve: {
    conditions: ['react-native', 'require', 'default'],
    // Tamagui's web entrypoint injects CSS via document (DOM), which crashes in Node.js
    // tests. The native-test bundle is a self-contained CJS file with zero DOM access,
    // using inline styles (React Native mode). This aliases @tamagui/core to that bundle.
    // All Tamagui imports must resolve to the SAME bundle so they share
    // React contexts (TamaguiProvider, ThemeStateContext, etc.). The tamagui
    // umbrella native.cjs is a self-contained bundle with all core exports
    // plus UI components, using React Native rendering (no DOM/react-native-web).
    alias: {
      '@tamagui/core': resolve(__dirname, 'node_modules/tamagui/dist/native.cjs'),
      '@tamagui/switch': resolve(__dirname, 'node_modules/tamagui/dist/native.cjs'),
      tamagui: resolve(__dirname, 'node_modules/tamagui/dist/native.cjs'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    // RNTL's first render auto-detects host component names (renders View/Text/Modal/etc.).
    // This is expensive in our Vitest environment; allow 30s for it.
    testTimeout: 30000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'lcov'],
      include: ['src/**/*.{ts,tsx}', 'app/(auth)/**/*.{ts,tsx}', 'app/(onboarding)/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'app/**/*.test.{ts,tsx}',
        'src/test/**',
        // Expo Router layout files are framework scaffolding (navigation guards,
        // QueryClientProvider setup) — not business logic we unit-test.
        'app/**/_layout.tsx',
        // Firebase SDK initialization — testing it would test the SDK, not our code.
        'src/lib/firebase.ts',
      ],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
    include: ['src/**/*.test.{ts,tsx}', 'app/**/*.test.{ts,tsx}', '*.test.ts'],
  },
})
