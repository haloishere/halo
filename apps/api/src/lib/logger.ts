import { createGcpLoggingPinoConfig } from '@google-cloud/pino-logging-gcp-config'
import type { LoggerOptions } from 'pino'
import { PHI_BODY_FIELDS } from './phi-fields.js'

// Pino redact paths derived from the canonical PHI_BODY_FIELDS — HIPAA-adjacent requirement.
// Covers request bodies with care-recipient data, auth credentials, and sensitive tokens.
// Source of truth for field names: phi-fields.ts
const REDACT_PATHS = [
  ...PHI_BODY_FIELDS.map((f) => `req.body.${f}`),
  'req.headers.authorization',
  'req.headers["x-api-key"]',
  '*.password',
  '*.token',
]

/**
 * Builds environment-aware pino logger options.
 *
 * - development/test: pino-pretty with colorized output
 * - production/staging: GCP Cloud Logging structured JSON format
 */
export function buildLoggerConfig(): LoggerOptions {
  const level = process.env.LOG_LEVEL || 'info'
  const env = process.env.NODE_ENV

  if (env === 'development' || env === 'test') {
    return {
      level,
      transport: {
        target: 'pino-pretty',
        options: { colorize: true },
      },
      redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
    }
  }

  try {
    return {
      ...createGcpLoggingPinoConfig({ serviceContext: { service: 'halo-api' } }, { level }),
      redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
    }
  } catch (err) {
    // Cannot use the pino logger here — it hasn't been created yet.
    // Write directly to stderr so the degradation is visible in Cloud Build and Cloud Run startup logs.
    process.stderr.write(
      `[halo-api] WARN: GCP logging config failed — falling back to plain JSON. ` +
        `Structured logging will be unavailable. Error: ${err instanceof Error ? err.stack : String(err)}\n`,
    )
    return { level, redact: { paths: REDACT_PATHS, censor: '[REDACTED]' } }
  }
}
