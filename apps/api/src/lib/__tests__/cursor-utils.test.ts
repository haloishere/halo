import { describe, it, expect } from 'vitest'
import { parseCursor } from '../cursor-utils.js'

describe('parseCursor', () => {
  it('parses valid cursor with ISO date and UUID', () => {
    const result = parseCursor(
      '2026-03-28T08:00:00.000Z|550e8400-e29b-41d4-a716-446655440000',
    )
    expect(result).not.toBeNull()
    expect(result!.date).toBeInstanceOf(Date)
    expect(result!.id).toBe('550e8400-e29b-41d4-a716-446655440000')
  })

  it('returns null for missing pipe separator', () => {
    expect(parseCursor('justgarbage')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parseCursor('')).toBeNull()
  })

  it('returns null for invalid date', () => {
    expect(
      parseCursor('not-a-date|550e8400-e29b-41d4-a716-446655440000'),
    ).toBeNull()
  })

  it('returns null for invalid UUID', () => {
    expect(parseCursor('2026-03-28T08:00:00.000Z|notauuid')).toBeNull()
  })

  it('returns null for valid date but short UUID', () => {
    expect(parseCursor('2026-03-28T08:00:00.000Z|12345')).toBeNull()
  })

  it('accepts uppercase UUID', () => {
    const result = parseCursor(
      '2026-03-28T08:00:00.000Z|550E8400-E29B-41D4-A716-446655440000',
    )
    expect(result).not.toBeNull()
  })

  it('preserves exact date value', () => {
    const isoDate = '2026-01-15T14:30:45.123Z'
    const result = parseCursor(
      `${isoDate}|550e8400-e29b-41d4-a716-446655440000`,
    )
    expect(result!.date.toISOString()).toBe(isoDate)
  })
})
