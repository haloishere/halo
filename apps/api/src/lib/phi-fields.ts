/**
 * Canonical PHI field names — single source of truth for both Pino log
 * redaction (logger.ts) and Sentry event scrubbing (sentry.ts).
 *
 * When adding a new PHI field to any schema, add it here first.
 * Both redaction systems derive their field lists from this constant.
 *
 * HIPAA-adjacent requirement: these fields must never appear in
 * external logging or error-tracking services.
 */
export const PHI_BODY_FIELDS = [
  'name',
  'diagnosisDetails',
  'dateOfBirth',
  'content',
  'email',
] as const

export type PhiBodyField = (typeof PHI_BODY_FIELDS)[number]
