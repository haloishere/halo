// CJS require hook: resolves .js → .ts for drizzle-kit's internal CJS loader.
// drizzle-kit bundles its own _resolveFilename override in bin.cjs (line ~16806).
// We patch Module._resolveFilename BEFORE drizzle-kit loads, so our hook runs
// when drizzle-kit's resolver fails on .js extensions.
const Module = require('module')
const path = require('path')
const fs = require('fs')

const origResolveFilename = Module._resolveFilename
Module._resolveFilename = function (request, parent, isMain, options) {
  // Only remap .js → .ts for files inside our schema directory
  if (request.endsWith('.js') && parent && parent.filename) {
    const parentDir = path.dirname(parent.filename)
    const tsPath = path.resolve(parentDir, request.replace(/\.js$/, '.ts'))
    if (fs.existsSync(tsPath)) {
      return origResolveFilename.call(this, tsPath, parent, isMain, options)
    }
  }
  return origResolveFilename.call(this, request, parent, isMain, options)
}
