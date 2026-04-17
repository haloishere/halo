/**
 * Fast synchronous PHI detection for community content.
 * Catches obvious PHI patterns before content is persisted.
 * This is a defense-in-depth layer — async moderation catches subtler cases.
 */

const PHI_PATTERNS: RegExp[] = [
  // SSN: XXX-XX-XXXX (but not phone patterns like 1-800-555-1234)
  /(?<!\d[-.])\b\d{3}-\d{2}-\d{4}\b/,

  // Email address with a capitalized name nearby (within 60 chars)
  /[A-Z][a-z]+\s+[A-Z][a-z]+.{0,40}[\w.+-]+@[\w-]+\.[\w.]+/,
  /[\w.+-]+@[\w-]+\.[\w.]+.{0,40}[A-Z][a-z]+\s+[A-Z][a-z]+/,

  // Medical Record Number: "MRN" followed by digits (with optional "is", ":", "#")
  /\bMRN\s*(?:is|[:#])?\s*\d{5,}/i,
  /\bmedical\s+record\s+(?:number|#|no\.?)\s*(?:is|[:#])?\s*\d{5,}/i,
]

export function containsPhi(text: string): boolean {
  for (const pattern of PHI_PATTERNS) {
    if (pattern.test(text)) {
      return true
    }
  }
  return false
}
