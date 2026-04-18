import { describe, it, expect } from 'vitest'
import {
  VAULT_ENTRY_TYPES,
  PREFERENCE_CATEGORIES,
  PREFERENCE_SENTIMENTS,
  preferenceContentSchema,
  vaultEntryInputSchema,
  vaultEntryRecordSchema,
} from '../vault'

describe('VAULT_ENTRY_TYPES', () => {
  it('includes preference as the V1 type', () => {
    expect(VAULT_ENTRY_TYPES).toContain('preference')
  })
})

describe('preferenceContentSchema', () => {
  const valid = {
    category: 'food' as const,
    subject: 'spicy thai',
    sentiment: 'likes' as const,
    confidence: 0.85,
  }

  it('accepts minimal valid content', () => {
    const result = preferenceContentSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it('accepts optional notes', () => {
    const result = preferenceContentSchema.safeParse({ ...valid, notes: 'mentioned twice' })
    expect(result.success).toBe(true)
  })

  it('rejects empty subject', () => {
    const result = preferenceContentSchema.safeParse({ ...valid, subject: '' })
    expect(result.success).toBe(false)
  })

  it('rejects subject longer than 200 chars', () => {
    const result = preferenceContentSchema.safeParse({ ...valid, subject: 'a'.repeat(201) })
    expect(result.success).toBe(false)
  })

  it('rejects unknown category', () => {
    const result = preferenceContentSchema.safeParse({ ...valid, category: 'crypto' })
    expect(result.success).toBe(false)
  })

  it('rejects unknown sentiment', () => {
    const result = preferenceContentSchema.safeParse({ ...valid, sentiment: 'love' })
    expect(result.success).toBe(false)
  })

  it('rejects confidence outside [0,1]', () => {
    expect(preferenceContentSchema.safeParse({ ...valid, confidence: -0.1 }).success).toBe(false)
    expect(preferenceContentSchema.safeParse({ ...valid, confidence: 1.1 }).success).toBe(false)
  })

  it('rejects notes longer than 500 chars', () => {
    const result = preferenceContentSchema.safeParse({ ...valid, notes: 'a'.repeat(501) })
    expect(result.success).toBe(false)
  })

  it('exposes the four V1 categories', () => {
    expect(PREFERENCE_CATEGORIES).toEqual(['food', 'activity', 'place', 'lifestyle'])
  })

  it('exposes the three sentiments', () => {
    expect(PREFERENCE_SENTIMENTS).toEqual(['likes', 'dislikes', 'neutral'])
  })
})

describe('vaultEntryInputSchema (discriminated union)', () => {
  it('accepts a preference entry', () => {
    const result = vaultEntryInputSchema.safeParse({
      type: 'preference',
      content: { category: 'food', subject: 'sushi', sentiment: 'likes', confidence: 0.9 },
    })
    expect(result.success).toBe(true)
  })

  it('rejects an entry with an unknown type', () => {
    const result = vaultEntryInputSchema.safeParse({
      type: 'mood',
      content: { category: 'food', subject: 'x', sentiment: 'likes', confidence: 0.5 },
    })
    expect(result.success).toBe(false)
  })

  it('rejects a preference entry whose content is not a preferenceContent', () => {
    const result = vaultEntryInputSchema.safeParse({
      type: 'preference',
      content: { whatever: true },
    })
    expect(result.success).toBe(false)
  })
})

describe('vaultEntryRecordSchema', () => {
  const validRecord = {
    id: '11111111-1111-1111-1111-111111111111',
    userId: '22222222-2222-2222-2222-222222222222',
    type: 'preference' as const,
    content: {
      category: 'food' as const,
      subject: 'sushi',
      sentiment: 'likes' as const,
      confidence: 0.9,
    },
    createdAt: '2026-04-18T10:00:00.000Z',
    updatedAt: '2026-04-18T10:00:00.000Z',
    deletedAt: null,
  }

  it('accepts a valid record', () => {
    const result = vaultEntryRecordSchema.safeParse(validRecord)
    expect(result.success).toBe(true)
  })

  it('accepts deletedAt as a timestamp (soft-deleted row)', () => {
    const result = vaultEntryRecordSchema.safeParse({
      ...validRecord,
      deletedAt: '2026-04-18T11:00:00.000Z',
    })
    expect(result.success).toBe(true)
  })

  it('rejects a record without an id', () => {
    const rest = { ...validRecord }
    delete (rest as { id?: string }).id
    const result = vaultEntryRecordSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('rejects a record whose userId is not a uuid', () => {
    const result = vaultEntryRecordSchema.safeParse({ ...validRecord, userId: 'nope' })
    expect(result.success).toBe(false)
  })
})
