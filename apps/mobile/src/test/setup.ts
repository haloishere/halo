/**
 * Transform react-native's Flow-typed CJS source before Node.js tries to parse it.
 *
 * React Native 0.81+ ships uncompiled `.js` files with Flow type annotations
 * (`import typeof`, `component Foo(...)`, etc.) that Node.js's CJS parser cannot
 * understand. Vite's plugin transform pipeline is bypassed for CJS files that
 * Node.js requires directly, so we intercept at the Node.js Module level.
 *
 * This hook also mirrors Metro's platform resolution: when a `.android.js` sibling
 * exists for any react-native `.js` file, we load the platform-specific file instead
 * (equivalent to Metro's `defaultPlatform: 'android'` / Jest's `haste.defaultPlatform`).
 *
 * This MUST be the first executable code in the setup file so the hook is in place
 * before any react-native module is first required.
 */
import Module from 'node:module'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join, basename } from 'node:path'
import { transformSync } from '@babel/core'

const rnPattern = /\/(?:react-native|@react-native)[/-]/
const flowMarkers = ['@flow', 'component ', 'import type']

// Platform to simulate — mirrors Metro's defaultPlatform and Jest's haste.defaultPlatform.
const TEST_PLATFORM = 'android'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const originalJsLoader = (Module as any)._extensions['.js']
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(Module as any)._extensions['.js'] = function (mod: any, filename: string) {
  // Tamagui v2 RC native.cjs has a web-oriented createDOMProps path where
  // getCSSStylesAtomic is a no-op returning undefined. When a component has
  // inline styles, flattenStyle returns truthy, getCSSStylesAtomic() returns
  // undefined, and .reduce() crashes. Patch it to return [] at load time.
  if (filename.includes('tamagui/dist/')) {
    let code = readFileSync(filename, 'utf-8')
    if (code.includes('getCSSStylesAtomic = empty')) {
      code = code.replace(
        'getCSSStylesAtomic = empty, getStyleAtomic = empty',
        'getCSSStylesAtomic = function() { return [] }, getStyleAtomic = function() { return [] }',
      )
      mod._compile(code, filename)
      return
    }
  }
  if (rnPattern.test(filename)) {
    // React Native ships platform-specific implementations as Foo.android.js / Foo.ios.js.
    // Node.js does not understand Metro's platform-extension resolution, so when
    // Node loads Foo.js it never automatically picks Foo.android.js. We mirror
    // Metro's defaultPlatform behavior: if a .android.js sibling exists, use it.
    // The recursive call ensures the platform file also gets Babel-transformed.
    if (!filename.endsWith(`.${TEST_PLATFORM}.js`) && !filename.endsWith('.ios.js')) {
      const platformFile = join(
        dirname(filename),
        `${basename(filename, '.js')}.${TEST_PLATFORM}.js`,
      )
      if (existsSync(platformFile)) {
        // Recursively invoke the patched loader so the platform file is also transformed.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (Module as any)._extensions['.js'].call(this, mod, platformFile)
      }
    }

    const code = readFileSync(filename, 'utf-8')
    if (flowMarkers.some((m) => code.includes(m))) {
      const result = transformSync(code, {
        filename,
        babelrc: false,
        configFile: false,
        // disableImportExportTransform:false (default) converts ESM→CJS,
        // which is required for Module._extensions / Node.js CJS loading.
        presets: [['@react-native/babel-preset', { dev: false, enableBabelRuntime: false }]],
      })
      if (result?.code) {
        mod._compile(result.code, filename)
        return
      }
    }
  }
  originalJsLoader(mod, filename)
}

import { vi } from 'vitest'

// ─── React Native bridge globals ─────────────────────────────────────────────
// react-native uses TurboModuleRegistry to access native modules. In tests we
// need to provide mock implementations so module-level init code doesn't throw.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockFn = () => (): any => undefined

// Known modules with specific shape requirements
const NATIVE_MODULE_MOCKS: Record<string, unknown> = {
  DeviceInfo: {
    getConstants: () => ({
      Dimensions: {
        window: { width: 375, height: 812, scale: 2, fontScale: 1 },
        screen: { width: 375, height: 812, scale: 2, fontScale: 1 },
      },
    }),
  },
  PlatformConstants: {
    getConstants: () => ({
      isTesting: true,
      isDisableAnimations: false,
      reactNativeVersion: { major: 0, minor: 81, patch: 0, prerelease: null },
      Version: 29,
      Release: '10',
      Serial: 'unknown',
      Fingerprint: 'unknown',
      Model: 'Android SDK built for x86',
      ServerHost: undefined,
      uiMode: 'normal',
      Brand: 'Android',
      Manufacturer: 'Google',
    }),
  },
  StatusBarManager: {
    getConstants: () => ({ HEIGHT: 44 }),
    setStyle: mockFn(),
    setHidden: mockFn(),
  },
  I18nManager: { getConstants: () => ({ isRTL: false, doLeftAndRightSwapInRTL: true }) },
  UIManager: { getConstants: () => ({}) },
}

// A generic Proxy that satisfies any getEnforcing() call without crashing
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const genericModuleProxy = new Proxy({} as any, {
  get(_target, prop) {
    if (typeof prop === 'symbol' || prop === 'then') return undefined
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (..._args: any[]): any => null
  },
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(global as any).__turboModuleProxy = (name: string) =>
  NATIVE_MODULE_MOCKS[name] ?? genericModuleProxy

// Legacy bridge config — prevents NativeModules.js invariant
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(global as any).__fbBatchedBridgeConfig = { remoteModuleConfig: [], localModulesConfig: [] }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(global as any).nativeFabricUIManager = null

// addEventListener / removeEventListener are called by @tamagui/web compiled
// code when it detects it may be in a browser environment. Keep them as no-ops.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(global as any).addEventListener = vi.fn()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(global as any).removeEventListener = vi.fn()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(global as any).dispatchEvent = vi.fn(() => true)

// @tamagui/web's insertStyleRule and createComponent access `document` to inject
// CSS and listen for visibility changes. In Node.js tests there is no DOM, so we
// provide a minimal stub that satisfies all Tamagui call sites.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (!(global as any).document) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const noop = (): any => undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(global as any).document = {
    createElement: () => ({
      sheet: { cssRules: [] as string[], insertRule: () => 0, deleteRule: noop },
      setAttribute: noop,
      appendChild: noop,
      textContent: '',
      style: {},
    }),
    // appendChild must return the appended element (Tamagui accesses .sheet on it)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    head: { appendChild: (el: any) => el, removeChild: noop },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body: { appendChild: (el: any) => el },
    createTextNode: () => ({}),
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
    addEventListener: noop,
    removeEventListener: noop,
    dispatchEvent: () => true,
    documentElement: {
      style: {},
      classList: { add: noop, remove: noop, contains: () => false },
      addEventListener: noop,
      removeEventListener: noop,
    },
    // Tamagui checks visibilityState
    visibilityState: 'visible',
    // CSSStyleSheet operations
    styleSheets: [],
  }
}

// React Native 0.81 renderer accesses bare `window` (not via typeof) in some code
// paths (e.g. error event dispatch). Define window as global so those accesses return
// undefined/no-op rather than throwing ReferenceError. We set it AFTER the
// addEventListener stubs above so window.addEventListener also resolves correctly.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(global as any).location = { href: '', origin: '', protocol: 'https:' }
// Tamagui's Dimensions/media query code accesses window.screen and devicePixelRatio
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(global as any).screen = { width: 375, height: 812 }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(global as any).devicePixelRatio = 2
// matchMedia stub — Tamagui's configureMedia calls window.matchMedia for responsive breakpoints
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(global as any).matchMedia =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).matchMedia ||
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ((query: string): any => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  }))
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(global as any).window = global
// Tamagui's Image component calls `new window.Image()` internally for preloading.
// Node.js has no DOM Image constructor, so stub it.
Object.assign(globalThis, {
  Image: class Image {
    src = ''
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    width = 0
    height = 0
  },
})
// @tamagui/constants accesses `navigator` as a bare global (no typeof guard).
// Node.js 21+ exposes navigator natively; Node.js 20 (used in CI) does not.
// Stub it so the tamagui config test doesn't throw ReferenceError on Node 20.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (!(global as any).navigator) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(global as any).navigator = { userAgent: 'node' }
}
// ─────────────────────────────────────────────────────────────────────────────

global.IS_REACT_ACT_ENVIRONMENT = true
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(global as any).IS_REACT_NATIVE_TEST_ENVIRONMENT = true
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(global as any).__DEV__ = true
global.cancelAnimationFrame = (id) => clearTimeout(id)
global.requestAnimationFrame = (callback) => setTimeout(() => callback(Date.now()), 0)
if (!global.performance) global.performance = { now: Date.now } as Performance
process.env.RNTL_SKIP_AUTO_DETECT_FAKE_TIMERS = '1'

// In-memory SecureStore — cleared per-test via beforeEach in individual test files
const secureStoreMap: Record<string, string> = {}

// Swap Reanimated-based animations for a no-op driver in tests to avoid react-native-web
// DOM stylesheet operations that Node.js can't satisfy.
vi.mock('@tamagui/config/v5-rn', () => ({
  animations: {
    animations: { quick: {}, medium: {}, slow: {} },
    View: undefined,
    Text: undefined,
    useAnimatedNumber: () => ({ getInstance: () => 0, getValue: () => 0, setValue: () => {} }),
    useAnimatedNumberStyle: () => ({}),
    useAnimatedNumberReaction: () => {},
    usePresence: () => [true, undefined],
    ResetPresence: ({ children }: { children: unknown }) => children,
    isReactNative: true,
  },
}))

// react-native-reanimated requires native Worklets; stub for tests.
vi.mock('react-native-reanimated', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react')
  const AnimatedView = (props: Record<string, unknown>) =>
    React.createElement('View', props, props['children'])
  const AnimatedText = (props: Record<string, unknown>) =>
    React.createElement('Text', props, props['children'])
  const actual = {
    default: { View: AnimatedView, Text: AnimatedText },
    View: AnimatedView,
    Text: AnimatedText,
    useSharedValue: (init: unknown) => ({ value: init }),
    useAnimatedStyle: (fn: () => unknown) => fn(),
    withTiming: (val: unknown) => val,
    withSequence: (...args: unknown[]) => args[args.length - 1],
    withRepeat: (val: unknown) => val,
    cancelAnimation: vi.fn(),
    useReducedMotion: () => false,
    Easing: { out: () => {}, inOut: () => {} },
    FadeIn: { duration: () => ({ duration: () => ({}) }) },
    FadeOut: { duration: () => ({ duration: () => ({}) }) },
  }
  return { __esModule: true, ...actual }
})

// react-native-svg requires native code; stub with plain React elements for tests.
vi.mock('react-native-svg', async () => {
  const React = await import('react')
  const createMock = (name: string) =>
    React.forwardRef((props: Record<string, unknown>, ref: unknown) =>
      React.createElement(name, { ...props, ref }),
    )
  return {
    __esModule: true,
    default: createMock('Svg'),
    Svg: createMock('Svg'),
    Path: createMock('Path'),
    Circle: createMock('Circle'),
    Rect: createMock('Rect'),
    G: createMock('G'),
  }
})

vi.mock('react-native-keyboard-controller', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react')
  return {
    __esModule: true,
    KeyboardProvider: ({ children }: { children: unknown }) => children,
    KeyboardAvoidingView: ({ children, style }: { children?: unknown; style?: unknown }) =>
      React.createElement('View', { style }, children),
    useKeyboardHandler: vi.fn(),
    useReanimatedKeyboardAnimation: () => ({ height: { value: 0 }, progress: { value: 0 } }),
  }
})

vi.mock('@tamagui/native/setup-teleport', () => ({}))
vi.mock('@tamagui/native/setup-burnt', () => ({}))

vi.mock('react-native-teleport', () => ({
  default: ({ children }: { children: unknown }) => children,
  TeleportProvider: ({ children }: { children: unknown }) => children,
}))

vi.mock('burnt', () => ({
  toast: vi.fn(),
  alert: vi.fn(),
  dismissAllAlerts: vi.fn(),
}))

// Not exported — only prevents runtime errors in tests that don't override @tamagui/toast mock.
// Tests needing hide() assertions should define their own vi.mock('@tamagui/toast').
const mockToastHide = vi.fn()
vi.mock('@tamagui/toast', () => ({
  useToastController: () => ({ show: vi.fn(), hide: mockToastHide, nativeToast: vi.fn() }),
  useToastState: () => null,
  ToastProvider: ({ children }: { children: unknown }) => children,
  ToastViewport: () => null,
  Toast: Object.assign(() => null, {
    Title: () => null,
    Description: () => null,
    Action: () => null,
    Close: () => null,
  }),
}))

vi.mock('@expo-google-fonts/grand-hotel', () => ({
  useFonts: () => [true],
  GrandHotel_400Regular: 'GrandHotel_400Regular',
}))

vi.mock('expo-font', () => ({
  useFonts: () => [true],
  loadAsync: vi.fn(),
  isLoaded: () => true,
}))

vi.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: vi.fn(),
  hideAsync: vi.fn(),
}))

vi.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      extra: {
        firebase: {
          apiKey: 'test-api-key',
          authDomain: 'test.firebaseapp.com',
          projectId: 'test-project',
          storageBucket: 'test.appspot.com',
          messagingSenderId: '123456',
          appId: '1:123456:web:abc123',
        },
        apiUrl: 'http://localhost:3000',
        googleWebClientId: 'test-web-client-id.apps.googleusercontent.com',
        eas: { projectId: 'test-eas-id' },
      },
    },
  },
}))

vi.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: vi.fn(),
    hasPlayServices: vi.fn().mockResolvedValue(true),
    signIn: vi.fn().mockResolvedValue({
      data: { idToken: 'mock-google-id-token', user: { email: 'test@gmail.com' } },
    }),
  },
  statusCodes: {
    SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
    IN_PROGRESS: 'IN_PROGRESS',
    PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
  },
  isErrorWithCode: (err: unknown): err is { code: string } => err instanceof Error && 'code' in err,
}))

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(() => Promise.resolve(null)),
    setItem: vi.fn(() => Promise.resolve()),
    removeItem: vi.fn(() => Promise.resolve()),
    clear: vi.fn(() => Promise.resolve()),
    getAllKeys: vi.fn(() => Promise.resolve([])),
    multiGet: vi.fn(() => Promise.resolve([])),
    multiSet: vi.fn(() => Promise.resolve()),
    multiRemove: vi.fn(() => Promise.resolve()),
  },
}))

vi.mock('expo-secure-store', () => ({
  setItemAsync: vi.fn(async (key: string, value: string) => {
    if (secureStoreMap['__setItem_throw']) {
      throw new Error('SecureStore: Could not encrypt/write value')
    }
    secureStoreMap[key] = value
  }),
  getItemAsync: vi.fn(async (key: string) => secureStoreMap[key] ?? null),
  deleteItemAsync: vi.fn(async (key: string) => {
    delete secureStoreMap[key]
  }),
}))

vi.mock('react-native-markdown-display', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react')
  return {
    __esModule: true,
    default: ({ children }: { children?: string }) =>
      React.createElement('View', { testID: 'markdown-display' }, children),
  }
})

vi.mock('react-native-webview', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react')
  return {
    __esModule: true,
    default: React.forwardRef((props: Record<string, unknown>, ref: unknown) =>
      React.createElement('View', { ...props, ref, testID: 'webview' }),
    ),
    WebView: React.forwardRef((props: Record<string, unknown>, ref: unknown) =>
      React.createElement('View', { ...props, ref, testID: 'webview' }),
    ),
  }
})

// react-native-image-viewing ships a Modal-based fullscreen viewer that pulls in
// Reanimated and gesture handlers. Tests transitively importing PostImageGallery
// only need to know it renders; individual tests that assert on visible/imageIndex
// override this mock locally.
vi.mock('react-native-image-viewing', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react')
  return {
    __esModule: true,
    default: (props: { visible?: boolean }) =>
      props.visible ? React.createElement('View', { testID: 'image-viewer-stub' }) : null,
  }
})

vi.mock('react-native/Libraries/Utilities/Platform', () => ({
  default: {
    OS: 'android',
    select: (obj: Record<string, unknown>) => obj['android'] ?? obj['default'],
  },
  OS: 'android',
  select: (obj: Record<string, unknown>) => obj['android'] ?? obj['default'],
}))

export { secureStoreMap }
