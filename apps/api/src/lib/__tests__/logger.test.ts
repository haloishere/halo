import { vi, describe, it, expect, afterEach } from 'vitest'
import { createGcpLoggingPinoConfig } from '@google-cloud/pino-logging-gcp-config'
import { buildLoggerConfig } from '../logger.js'

// Spy that passes through to the real implementation by default.
// Individual tests can override with mockImplementationOnce() for the fallback path.
vi.mock('@google-cloud/pino-logging-gcp-config', async () => {
  const actual = await vi.importActual('@google-cloud/pino-logging-gcp-config')
  const module = actual as { createGcpLoggingPinoConfig: typeof createGcpLoggingPinoConfig }
  return { createGcpLoggingPinoConfig: vi.fn(module.createGcpLoggingPinoConfig) }
})

describe('buildLoggerConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.mocked(createGcpLoggingPinoConfig).mockClear()
  })

  it('defaults to info log level', () => {
    vi.stubEnv('LOG_LEVEL', '')
    const config = buildLoggerConfig()
    expect(config.level).toBe('info')
  })

  it('respects LOG_LEVEL env var', () => {
    vi.stubEnv('LOG_LEVEL', 'debug')
    const config = buildLoggerConfig()
    expect(config.level).toBe('debug')
  })

  it('development: uses pino-pretty transport', () => {
    vi.stubEnv('NODE_ENV', 'development')
    const config = buildLoggerConfig()
    expect(config.transport).toBeDefined()
    expect(config.transport?.target).toBe('pino-pretty')
    expect(config.transport?.options?.colorize).toBe(true)
  })

  it('production: uses GCP structured logging formatters (no transport)', () => {
    vi.stubEnv('NODE_ENV', 'production')
    const config = buildLoggerConfig()
    expect(config.transport).toBeUndefined()
    expect(config.formatters).toBeDefined()
    expect(config.formatters?.level).toBeTypeOf('function')
  })

  it('test env: uses pino-pretty transport', () => {
    vi.stubEnv('NODE_ENV', 'test')
    const config = buildLoggerConfig()
    expect(config.transport?.target).toBe('pino-pretty')
  })

  it('unknown env: falls back to GCP formatters', () => {
    vi.stubEnv('NODE_ENV', 'staging')
    const config = buildLoggerConfig()
    expect(config.transport).toBeUndefined()
    expect(config.formatters).toBeDefined()
  })

  it('respects LOG_LEVEL in production mode', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('LOG_LEVEL', 'warn')
    const config = buildLoggerConfig()
    expect(config.level).toBe('warn')
  })

  describe('log redaction', () => {
    // Helper to get typed redact config
    function getRedact(config: ReturnType<typeof buildLoggerConfig>) {
      return config.redact as { paths: string[]; censor: string }
    }

    it('dev env: redacts all PHI body fields, auth headers, and sensitive tokens', () => {
      vi.stubEnv('NODE_ENV', 'development')
      const redact = getRedact(buildLoggerConfig())
      expect(redact.censor).toBe('[REDACTED]')
      // PHI body fields
      expect(redact.paths).toContain('req.body.name')
      expect(redact.paths).toContain('req.body.diagnosisDetails')
      expect(redact.paths).toContain('req.body.dateOfBirth')
      expect(redact.paths).toContain('req.body.content')
      expect(redact.paths).toContain('req.body.email')
      // Auth credentials
      expect(redact.paths).toContain('req.headers.authorization')
      expect(redact.paths).toContain('req.headers["x-api-key"]')
      // Sensitive tokens anywhere in the log object
      expect(redact.paths).toContain('*.password')
      expect(redact.paths).toContain('*.token')
    })

    it('production env: redacts all PHI paths with correct censor string', () => {
      vi.stubEnv('NODE_ENV', 'production')
      const redact = getRedact(buildLoggerConfig())
      expect(redact.censor).toBe('[REDACTED]')
      expect(redact.paths).toContain('req.body.name')
      expect(redact.paths).toContain('req.body.diagnosisDetails')
      expect(redact.paths).toContain('req.body.dateOfBirth')
    })

    it('test env: redacts PHI paths with correct censor string', () => {
      vi.stubEnv('NODE_ENV', 'test')
      const redact = getRedact(buildLoggerConfig())
      expect(redact.censor).toBe('[REDACTED]')
      expect(redact.paths).toContain('req.body.name')
      expect(redact.paths).toContain('req.body.diagnosisDetails')
    })

    it('fallback path: redacts all PHI paths when GCP config throws', () => {
      vi.mocked(createGcpLoggingPinoConfig).mockImplementationOnce(() => {
        throw new Error('GCP config unavailable')
      })
      vi.stubEnv('NODE_ENV', 'production')
      const redact = getRedact(buildLoggerConfig())
      expect(redact.censor).toBe('[REDACTED]')
      // All PHI body fields must be present — this is the regression-risk path
      expect(redact.paths).toContain('req.body.name')
      expect(redact.paths).toContain('req.body.diagnosisDetails')
      expect(redact.paths).toContain('req.body.dateOfBirth')
      expect(redact.paths).toContain('req.body.content')
      expect(redact.paths).toContain('req.body.email')
      expect(redact.paths).toContain('req.headers.authorization')
      expect(redact.paths).toContain('req.headers["x-api-key"]')
      expect(redact.paths).toContain('*.password')
      expect(redact.paths).toContain('*.token')
    })
  })
})
