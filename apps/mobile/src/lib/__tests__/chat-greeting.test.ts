import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getTimeOfDay, buildGreeting } from '../chat-greeting'

// Anchor fixture: returns a local-time Date pinned to 2026-05-15 with the
// given clock position. Uses the `new Date(year, monthIndex, day, ...)`
// constructor — unambiguously local time per ECMA-262, no ISO-string parsing
// footgun. May is month index 4.
function at(hours: number, minutes = 0, seconds = 0): Date {
  return new Date(2026, 4, 15, hours, minutes, seconds, 0)
}

describe('getTimeOfDay — bucket midpoints', () => {
  it('08:00 → morning', () => {
    expect(getTimeOfDay(at(8))).toBe('morning')
  })
  it('14:00 → afternoon', () => {
    expect(getTimeOfDay(at(14))).toBe('afternoon')
  })
  it('19:00 → evening', () => {
    expect(getTimeOfDay(at(19))).toBe('evening')
  })
  it('02:00 → lateNight', () => {
    expect(getTimeOfDay(at(2))).toBe('lateNight')
  })
})

describe('getTimeOfDay — boundary semantics (strict `<` bucket edges)', () => {
  // Morning window: [05:00, 12:00)
  it('04:59:59 → lateNight', () => {
    expect(getTimeOfDay(at(4, 59, 59))).toBe('lateNight')
  })
  it('05:00:00 → morning', () => {
    expect(getTimeOfDay(at(5, 0, 0))).toBe('morning')
  })
  it('11:59:59 → morning', () => {
    expect(getTimeOfDay(at(11, 59, 59))).toBe('morning')
  })
  it('12:00:00 → afternoon', () => {
    expect(getTimeOfDay(at(12, 0, 0))).toBe('afternoon')
  })

  // Afternoon window: [12:00, 17:00)
  it('16:59:59 → afternoon', () => {
    expect(getTimeOfDay(at(16, 59, 59))).toBe('afternoon')
  })
  it('17:00:00 → evening', () => {
    expect(getTimeOfDay(at(17, 0, 0))).toBe('evening')
  })

  // Evening window: [17:00, 22:00)
  it('21:59:59 → evening', () => {
    expect(getTimeOfDay(at(21, 59, 59))).toBe('evening')
  })
  it('22:00:00 → lateNight', () => {
    expect(getTimeOfDay(at(22, 0, 0))).toBe('lateNight')
  })

  // LateNight window: [22:00, 24:00) and [00:00, 05:00) — wraps midnight.
  // Covers the `hour === 0` case explicitly: a refactor to
  // `if (hour > 0 && hour < 5)` would pass every other bucket test.
  it('00:00:00 → lateNight (midnight)', () => {
    expect(getTimeOfDay(at(0, 0, 0))).toBe('lateNight')
  })
})

describe('getTimeOfDay — default date arg uses current time', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('with no argument, reads the system clock', () => {
    vi.setSystemTime(at(3)) // 03:00 local
    expect(getTimeOfDay()).toBe('lateNight')

    vi.setSystemTime(at(9)) // 09:00 local
    expect(getTimeOfDay()).toBe('morning')
  })
})

describe('buildGreeting — first-name extraction', () => {
  const morningDate = at(9) // force morning bucket so every title has a known prefix

  it('extracts first token from multi-word names', () => {
    expect(buildGreeting('Amir Jalali', morningDate).title).toBe('Good morning, Amir')
  })

  it('keeps single-word names as-is', () => {
    expect(buildGreeting('Amir', morningDate).title).toBe('Good morning, Amir')
  })

  it('trims leading/trailing whitespace', () => {
    expect(buildGreeting('  Amir  ', morningDate).title).toBe('Good morning, Amir')
  })

  it('collapses multiple internal spaces (takes first token)', () => {
    expect(buildGreeting('Amir    Jalali', morningDate).title).toBe('Good morning, Amir')
  })

  it('handles three-word names by taking only the first', () => {
    expect(buildGreeting('Amir Jalali Smith', morningDate).title).toBe('Good morning, Amir')
  })

  it('splits on non-breaking space (U+00A0) — names pasted from iOS contacts', () => {
    // Regression lock: a naive refactor to `split(' ')` (ASCII space only)
    // would silently break users whose display name contains NBSP between
    // tokens (common when copy-pasting from iOS contacts / messaging apps).
    // Both `String.prototype.trim()` and `/\s+/` handle NBSP per spec.
    expect(buildGreeting('Amir\u00A0Jalali', morningDate).title).toBe('Good morning, Amir')
  })

  it('falls back to "there" when displayName is null', () => {
    expect(buildGreeting(null, morningDate).title).toBe('Good morning, there')
  })

  it('falls back to "there" when displayName is undefined', () => {
    expect(buildGreeting(undefined, morningDate).title).toBe('Good morning, there')
  })

  it('falls back to "there" on empty string', () => {
    expect(buildGreeting('', morningDate).title).toBe('Good morning, there')
  })

  it('falls back to "there" on whitespace-only string', () => {
    expect(buildGreeting('   ', morningDate).title).toBe('Good morning, there')
  })
})

describe('buildGreeting — full payload for each time bucket', () => {
  it('morning payload', () => {
    const g = buildGreeting('Amir', at(9))
    expect(g).toEqual({
      title: 'Good morning, Amir',
      subtitle: "Take your time. I'm here.",
      timeOfDay: 'morning',
    })
  })

  it('afternoon payload', () => {
    const g = buildGreeting('Amir', at(14))
    expect(g).toEqual({
      title: 'Good afternoon, Amir',
      subtitle: "What's on your mind?",
      timeOfDay: 'afternoon',
    })
  })

  it('evening payload', () => {
    const g = buildGreeting('Amir', at(19))
    expect(g).toEqual({
      title: 'Good evening, Amir',
      subtitle: 'How was your day?',
      timeOfDay: 'evening',
    })
  })

  it('lateNight payload uses "Hi, {name}" title', () => {
    const g = buildGreeting('Amir', at(2))
    expect(g).toEqual({
      title: 'Hi, Amir',
      subtitle: "It's okay to be awake. I'm here.",
      timeOfDay: 'lateNight',
    })
  })
})

describe('buildGreeting — default date arg uses current time', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('with no date arg, reads the system clock', () => {
    vi.setSystemTime(at(14))
    const g = buildGreeting('Amir')
    expect(g.timeOfDay).toBe('afternoon')
    expect(g.title).toBe('Good afternoon, Amir')
  })
})
