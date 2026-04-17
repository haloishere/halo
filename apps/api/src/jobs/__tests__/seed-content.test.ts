import { describe, it, expect } from 'vitest'
import { sanitize, parseArticles } from '../seed-content.js'

describe('sanitize', () => {
  it('strips HTML tags', () => {
    expect(sanitize('Hello <b>world</b>')).toBe('Hello world')
  })

  it('strips control characters', () => {
    expect(sanitize('Hello\x00\x07World')).toBe('HelloWorld')
  })

  it('trims whitespace', () => {
    expect(sanitize('  hello  ')).toBe('hello')
  })

  it('handles empty string', () => {
    expect(sanitize('')).toBe('')
  })

  it('strips nested HTML', () => {
    expect(sanitize('<div><span>text</span></div>')).toBe('text')
  })
})

describe('parseArticles', () => {
  const category = 'daily_care' as const
  const stages = ['early', 'middle'] as const

  it('parses valid JSON array of articles', () => {
    const raw = JSON.stringify([
      { title: 'Test Article', slug: 'test-article', body: 'A'.repeat(60) },
    ])

    const result = parseArticles(raw, category, [...stages])
    expect(result).toHaveLength(1)
    expect(result[0]!.title).toBe('Test Article')
    expect(result[0]!.slug).toBe('test-article')
    expect(result[0]!.category).toBe('daily_care')
    expect(result[0]!.diagnosisStages).toEqual(['early', 'middle'])
  })

  it('strips markdown code fences from response', () => {
    const raw = '```json\n' + JSON.stringify([
      { title: 'Test', slug: 'test', body: 'B'.repeat(60) },
    ]) + '\n```'

    const result = parseArticles(raw, category, [...stages])
    expect(result).toHaveLength(1)
  })

  it('returns empty array for invalid JSON', () => {
    const result = parseArticles('not json at all', category, [...stages])
    expect(result).toEqual([])
  })

  it('returns empty array for non-array JSON', () => {
    const result = parseArticles('{"key": "value"}', category, [...stages])
    expect(result).toEqual([])
  })

  it('returns empty array for empty string', () => {
    const result = parseArticles('', category, [...stages])
    expect(result).toEqual([])
  })

  it('filters out articles with body <= 50 chars', () => {
    const raw = JSON.stringify([
      { title: 'Short', slug: 'short', body: 'Too short' },
      { title: 'Long', slug: 'long', body: 'C'.repeat(60) },
    ])

    const result = parseArticles(raw, category, [...stages])
    expect(result).toHaveLength(1)
    expect(result[0]!.slug).toBe('long')
  })

  it('filters out articles with missing required fields', () => {
    const raw = JSON.stringify([
      { title: '', slug: 'empty-title', body: 'D'.repeat(60) },
      { slug: 'no-title', body: 'E'.repeat(60) },
      { title: 'No Slug', body: 'F'.repeat(60) },
      { title: 'No Body', slug: 'no-body' },
    ])

    const result = parseArticles(raw, category, [...stages])
    expect(result).toEqual([])
  })

  it('sanitizes title (strips HTML)', () => {
    const raw = JSON.stringify([
      { title: '<b>Bold Title</b>', slug: 'bold', body: 'G'.repeat(60) },
    ])

    const result = parseArticles(raw, category, [...stages])
    expect(result[0]!.title).toBe('Bold Title')
  })

  it('sanitizes slug (lowercase, alphanumeric + hyphens only)', () => {
    const raw = JSON.stringify([
      { title: 'Test', slug: 'My Slug!@#$', body: 'H'.repeat(60) },
    ])

    const result = parseArticles(raw, category, [...stages])
    expect(result[0]!.slug).toBe('myslug')
  })

  it('truncates title to 200 chars', () => {
    const raw = JSON.stringify([
      { title: 'T'.repeat(300), slug: 'long-title', body: 'I'.repeat(60) },
    ])

    const result = parseArticles(raw, category, [...stages])
    expect(result[0]!.title.length).toBe(200)
  })
})
