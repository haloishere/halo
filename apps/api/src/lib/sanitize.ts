/** Strip HTML-significant characters from a display name (defense-in-depth behind Zod schema validation). */
export function sanitizeDisplayName(raw: string): string {
  return raw.replace(/[<>&"]/g, '').trim()
}

/** Strip angle brackets from user content to prevent stored XSS (defense-in-depth). */
export function sanitizeContent(raw: string): string {
  return raw.replace(/[<>]/g, '')
}
