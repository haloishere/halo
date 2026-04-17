const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')
const fs = require('fs')

const projectRoot = __dirname
const monorepoRoot = path.resolve(projectRoot, '../..')

if (!fs.existsSync(path.join(monorepoRoot, 'pnpm-workspace.yaml'))) {
  throw new Error(
    `Metro config: expected monorepo root at ${monorepoRoot} to contain pnpm-workspace.yaml. ` +
      'Verify the project is inside the monorepo workspace.',
  )
}

const config = getDefaultConfig(projectRoot)

// Watch the monorepo root so Metro can resolve workspace packages
config.watchFolders = [monorepoRoot]

// Resolve node_modules from both the mobile app and the monorepo root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
]

// Force single-copy resolution for react and its sub-entries (jsx-runtime, etc.).
// pnpm strict hoisting causes root-hoisted packages (e.g. keyboard-controller)
// to resolve react from root while the app resolves from the .pnpm store.
// extraNodeModules alone is insufficient — Metro still finds the root copy via
// nodeModulesPaths. We intercept resolution to redirect all react imports.
// Only redirect react — native packages (react-native, reanimated) must
// resolve naturally so their native module bindings stay intact.
const reactDir = path.dirname(require.resolve('react', { paths: [projectRoot] }))

const defaultResolveRequest = config.resolver.resolveRequest
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react' || moduleName.startsWith('react/')) {
    try {
      const resolved =
        moduleName === 'react'
          ? path.join(reactDir, 'index.js')
          : require.resolve(moduleName, { paths: [reactDir] })
      return { type: 'sourceFile', filePath: resolved }
    } catch (err) {
      console.warn(
        `[metro] Failed to resolve ${moduleName} from ${reactDir}, falling back:`,
        err.message,
      )
    }
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform)
  }
  return context.resolveRequest(context, moduleName, platform)
}

// Tamagui: exclude web-only modules from native bundle
config.resolver.resolverMainFields = ['react-native', 'browser', 'main']

module.exports = config
