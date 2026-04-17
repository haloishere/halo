import { createHash } from 'node:crypto'

/**
 * Produces a deterministic SHA-256 hex digest of an IP address.
 *
 * Handles:
 * - Single IPv4 or IPv6 addresses
 * - Comma-separated X-Forwarded-For values (takes the first, leftmost entry)
 * - Leading/trailing whitespace
 * - null, undefined, or empty string (returns null)
 *
 * The hash is one-way: the original IP is irrecoverable. This satisfies
 * HIPAA-adjacent privacy requirements while still allowing per-request
 * correlation within audit logs.
 */
export function hashIpAddress(ip: string | null | undefined): string | null {
  if (!ip) return null
  const rawIp = (ip.split(',')[0] ?? '').trim()
  if (!rawIp) return null
  return createHash('sha256').update(rawIp).digest('hex')
}

/**
 * Extracts and hashes the client IP from request headers.
 *
 * Prefers the X-Forwarded-For header (populated by Cloud Armor / GCP LB with
 * the real client IP) over remoteAddress (which is the LB's internal IP in
 * production).
 */
export function hashRequestIp(
  forwardedFor: string | undefined,
  remoteAddress: string | undefined,
): string | null {
  return hashIpAddress(forwardedFor ?? remoteAddress ?? null)
}
