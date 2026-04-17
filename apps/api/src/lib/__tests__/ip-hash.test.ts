import { describe, it, expect } from 'vitest'
import { hashIpAddress, hashRequestIp } from '../ip-hash.js'

describe('hashIpAddress', () => {
  it('returns a 64-char hex string for a valid IPv4 address', () => {
    const result = hashIpAddress('1.2.3.4')
    expect(result).toHaveLength(64)
    expect(result).toMatch(/^[0-9a-f]{64}$/)
  })

  it('returns a 64-char hex string for a valid IPv6 address', () => {
    const result = hashIpAddress('2001:db8::1')
    expect(result).toHaveLength(64)
    expect(result).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is deterministic — same IP always produces the same hash', () => {
    expect(hashIpAddress('1.2.3.4')).toBe(hashIpAddress('1.2.3.4'))
  })

  it('produces different hashes for different IPs', () => {
    expect(hashIpAddress('1.2.3.4')).not.toBe(hashIpAddress('1.2.3.5'))
  })

  it('returns null for null input', () => {
    expect(hashIpAddress(null)).toBeNull()
  })

  it('returns null for undefined input', () => {
    expect(hashIpAddress(undefined)).toBeNull()
  })

  it('returns null for empty string input', () => {
    expect(hashIpAddress('')).toBeNull()
  })

  it('takes the first IP from a comma-separated X-Forwarded-For value', () => {
    const multi = hashIpAddress('1.2.3.4, 10.0.0.1')
    const single = hashIpAddress('1.2.3.4')
    expect(multi).toBe(single)
  })

  it('trims whitespace around the IP before hashing', () => {
    const padded = hashIpAddress('  1.2.3.4  ')
    const clean = hashIpAddress('1.2.3.4')
    expect(padded).toBe(clean)
  })

  it('returns null for a whitespace-only string', () => {
    // '   ' is truthy so it passes the !ip guard, but trims to '' which returns null
    expect(hashIpAddress('   ')).toBeNull()
  })

  it('returns null when the first XFF entry is whitespace-only', () => {
    // '  , 10.0.0.1' — first segment trims to '' so returns null rather than hashing 10.0.0.1
    expect(hashIpAddress('  , 10.0.0.1')).toBeNull()
  })
})

describe('hashRequestIp', () => {
  it('prefers X-Forwarded-For over remoteAddress when both are present', () => {
    const result = hashRequestIp('1.2.3.4', '10.0.0.1')
    expect(result).toBe(hashIpAddress('1.2.3.4'))
  })

  it('falls back to remoteAddress when X-Forwarded-For is undefined', () => {
    const result = hashRequestIp(undefined, '10.0.0.1')
    expect(result).toBe(hashIpAddress('10.0.0.1'))
  })

  it('returns null when both arguments are undefined', () => {
    expect(hashRequestIp(undefined, undefined)).toBeNull()
  })

  it('returns null when XFF is empty string — does not fall back to remoteAddress', () => {
    // Documents the ?? (nullish coalescing) semantics: '' is not null/undefined,
    // so remoteAddress is ignored. Use undefined, not '', to trigger the fallback.
    expect(hashRequestIp('', '10.0.0.1')).toBeNull()
  })
})
