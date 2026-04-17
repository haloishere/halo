import { describe, it, expect } from 'vitest'
import { shouldResume, shouldResumeTimestamp } from '../chat-resume'
import type { AiConversation } from '@halo/shared'

// Fixed anchor time for deterministic math. All `updatedAt` offsets in
// these tests are computed relative to this constant.
const NOW = new Date('2026-05-15T12:00:00Z')

function mockConvAt(msAgo: number): AiConversation {
  return {
    id: '00000000-0000-4000-8000-000000000000',
    userId: '00000000-0000-4000-8000-000000000001',
    title: 'test',
    summary: null,
    createdAt: new Date(NOW.getTime() - msAgo).toISOString(),
    updatedAt: new Date(NOW.getTime() - msAgo).toISOString(),
  }
}

const ONE_HOUR_MS = 60 * 60 * 1000
const TWO_HOURS_MS = 2 * ONE_HOUR_MS
const THREE_HOURS_MS = 3 * ONE_HOUR_MS

describe('shouldResume — absence cases', () => {
  it('returns false when the most-recent conversation is undefined (empty list)', () => {
    expect(shouldResume(undefined, NOW)).toBe(false)
  })

  it('returns false when the most-recent conversation is null', () => {
    expect(shouldResume(null, NOW)).toBe(false)
  })
})

describe('shouldResume — fresh activity (< 2h)', () => {
  it('returns true for activity 1 hour ago', () => {
    expect(shouldResume(mockConvAt(ONE_HOUR_MS), NOW)).toBe(true)
  })

  it('returns true for activity 1 millisecond ago', () => {
    expect(shouldResume(mockConvAt(1), NOW)).toBe(true)
  })

  it('returns true for activity just under 2h (2h - 1ms)', () => {
    expect(shouldResume(mockConvAt(TWO_HOURS_MS - 1), NOW)).toBe(true)
  })
})

describe('shouldResume — stale activity (≥ 2h)', () => {
  it('returns false for activity exactly 2 hours ago (boundary lock — strict `<`, not `<=`)', () => {
    // This is the load-bearing boundary test. A refactor from `<` to `<=`
    // would silently flip this assertion and bypass the plan's spec.
    expect(shouldResume(mockConvAt(TWO_HOURS_MS), NOW)).toBe(false)
  })

  it('returns false for activity just over 2h (2h + 1ms)', () => {
    expect(shouldResume(mockConvAt(TWO_HOURS_MS + 1), NOW)).toBe(false)
  })

  it('returns false for activity 3 hours ago', () => {
    expect(shouldResume(mockConvAt(THREE_HOURS_MS), NOW)).toBe(false)
  })

  it('returns false for activity weeks ago', () => {
    expect(shouldResume(mockConvAt(30 * 24 * ONE_HOUR_MS), NOW)).toBe(false)
  })
})

describe('shouldResume — future timestamps (clock skew defense)', () => {
  it('returns true when updatedAt is slightly in the future (device clock drift)', () => {
    // If the server returns a timestamp ~100ms ahead of device local time
    // (clock skew is normal across Cloud Run + device NTP), the delta is
    // negative which is still < 2h. Resume path is correct — refusing to
    // resume a just-touched conversation would be worse than accepting a
    // small negative delta.
    const futureConv = mockConvAt(-100)
    expect(shouldResume(futureConv, NOW)).toBe(true)
  })
})

describe('shouldResume — malformed updatedAt', () => {
  it('returns false when updatedAt is an invalid ISO string', () => {
    // Defense-in-depth: if the API ever returns garbage, don't resume
    // stale/uncertain data. Prefer creating a fresh conversation.
    const broken = {
      id: '00000000-0000-4000-8000-000000000000',
      userId: '00000000-0000-4000-8000-000000000001',
      title: null,
      summary: null,
      createdAt: '2026-05-15T12:00:00Z',
      updatedAt: 'not-a-date',
    } as unknown as AiConversation
    expect(shouldResume(broken, NOW)).toBe(false)
  })
})

describe('shouldResumeTimestamp — millisecond sibling for persisted lastChatUpdatedAt', () => {
  const NOW_MS = NOW.getTime()

  it('returns false when timestamp is null (no persisted chat)', () => {
    expect(shouldResumeTimestamp(null, NOW)).toBe(false)
  })

  it('returns true when timestamp is 1h ago (well within window)', () => {
    expect(shouldResumeTimestamp(NOW_MS - 60 * 60 * 1000, NOW)).toBe(true)
  })

  it('returns false at exactly the 2h boundary (strict `<`, not `<=`)', () => {
    expect(shouldResumeTimestamp(NOW_MS - 2 * 60 * 60 * 1000, NOW)).toBe(false)
  })

  it('returns false when timestamp is 3h ago (stale)', () => {
    expect(shouldResumeTimestamp(NOW_MS - 3 * 60 * 60 * 1000, NOW)).toBe(false)
  })

  it('returns true at just-under the boundary (01:59:59.999 ago)', () => {
    expect(shouldResumeTimestamp(NOW_MS - (2 * 60 * 60 * 1000 - 1), NOW)).toBe(true)
  })

  it('returns true for slightly-future timestamps (clock skew)', () => {
    // Same tolerance as `shouldResume`: a just-touched chat is better
    // resumed than discarded.
    expect(shouldResumeTimestamp(NOW_MS + 5_000, NOW)).toBe(true)
  })
})
