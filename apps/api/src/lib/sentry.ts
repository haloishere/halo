import * as Sentry from '@sentry/node'
import { PHI_BODY_FIELDS } from './phi-fields.js'

function getTracesSampleRate(): number {
  const env = process.env.NODE_ENV
  if (env === 'production' || env === 'staging') return 0.1
  return 0
}

/**
 * Scrubs PHI fields and auth credentials from a Sentry event.
 *
 * Applied to BOTH error events (beforeSend) and transaction/trace events
 * (beforeSendTransaction). Both can carry request.data containing PHI.
 *
 * Generic over T (Event or TransactionEvent) so the same function satisfies
 * both Sentry hook signatures without type assertions at the call site.
 *
 * Returns null on any unexpected error to drop the event rather than risk
 * PHI egress to Sentry's servers — the safe failure mode for a PHI scrubber.
 */
function scrubPhiFromEvent<T extends Sentry.Event>(event: T): T | null {
  try {
    if (!event.request) return event

    const original = event.request
    let data = original.data
    let headers = original.headers

    // Scrub PHI from request body — handle both parsed object and JSON string forms.
    // Sentry may serialize the body as a string rather than parsing it.
    if (data && typeof data === 'object') {
      const obj = { ...(data as Record<string, unknown>) }
      for (const field of PHI_BODY_FIELDS) {
        // eslint-disable-next-line security/detect-object-injection -- field iterates PHI_BODY_FIELDS constant, not user input
        if (field in obj) obj[field] = '[REDACTED]'
      }
      data = obj as typeof original.data
    } else if (typeof data === 'string') {
      let scrubbed = data
      for (const field of PHI_BODY_FIELDS) {
        // eslint-disable-next-line security/detect-non-literal-regexp -- field is from PHI_BODY_FIELDS constant, not user input
        const pattern = new RegExp(`("${field}"\\s*:\\s*)"[^"]*"`, 'g')
        scrubbed = scrubbed.replace(pattern, `$1"[REDACTED]"`)
      }
      data = scrubbed
    }

    // Scrub authorization header — immutable spread, no in-place mutation.
    if (headers && 'authorization' in headers) {
      headers = { ...headers, authorization: '[REDACTED]' }
    }

    return { ...event, request: { ...original, data, headers } } as T
  } catch (err) {
    process.stderr.write(
      `[halo-api] ERROR: Sentry PHI scrub failed — dropping event to prevent PHI egress. ` +
        `Error: ${err instanceof Error ? err.stack : String(err)}\n`,
    )
    return null
  }
}

export function initSentry() {
  if (!process.env.SENTRY_DSN) {
    process.stderr.write('[halo-api] WARN: SENTRY_DSN not set — error tracking is DISABLED.\n')
    return
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: getTracesSampleRate(),
    enabled: process.env.NODE_ENV !== 'test',
    // beforeSend: error/exception events (captureException in error-handler.ts)
    // beforeSendTransaction: performance trace spans
    // Both can carry request.data containing PHI — both must be scrubbed.
    beforeSend: scrubPhiFromEvent,
    beforeSendTransaction: scrubPhiFromEvent,
  })
}

export { Sentry }
