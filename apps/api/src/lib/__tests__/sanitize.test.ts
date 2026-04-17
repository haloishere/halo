import { describe, it, expect } from 'vitest'
import { sanitizeDisplayName, sanitizeContent } from '../sanitize.js'

describe('sanitizeDisplayName', () => {
  it('passes through clean names unchanged', () => {
    expect(sanitizeDisplayName('Alice')).toBe('Alice')
  })

  it('strips angle brackets', () => {
    expect(sanitizeDisplayName('<Alice>')).toBe('Alice')
  })

  it('strips ampersand', () => {
    expect(sanitizeDisplayName('Alice & Bob')).toBe('Alice  Bob')
  })

  it('strips double quotes', () => {
    expect(sanitizeDisplayName('"Alice"')).toBe('Alice')
  })

  it("preserves apostrophes (O'Brien)", () => {
    expect(sanitizeDisplayName("O'Brien")).toBe("O'Brien")
  })

  it('strips combined HTML characters', () => {
    expect(sanitizeDisplayName('<script>alert("xss")</script>')).toBe('scriptalert(xss)/script')
  })

  it('trims whitespace', () => {
    expect(sanitizeDisplayName('  Alice  ')).toBe('Alice')
  })

  it('preserves Unicode characters', () => {
    expect(sanitizeDisplayName('René')).toBe('René')
    expect(sanitizeDisplayName('María')).toBe('María')
  })

  it('preserves CJK characters', () => {
    expect(sanitizeDisplayName('太郎')).toBe('太郎')
  })

  it('returns empty string when all characters are stripped', () => {
    expect(sanitizeDisplayName('<>&"')).toBe('')
  })

  it('returns empty string for whitespace-only input after trim', () => {
    expect(sanitizeDisplayName('   ')).toBe('')
  })

  it('preserves hyphens', () => {
    expect(sanitizeDisplayName('Anne-Marie')).toBe('Anne-Marie')
  })

  it('preserves periods', () => {
    expect(sanitizeDisplayName('Dr. Smith')).toBe('Dr. Smith')
  })
})

describe('sanitizeContent', () => {
  it('passes through clean prose unchanged', () => {
    expect(sanitizeContent('My mom needs help with daily care.')).toBe(
      'My mom needs help with daily care.',
    )
  })

  it('strips angle brackets', () => {
    expect(sanitizeContent('<script>alert("xss")</script>')).toBe('scriptalert("xss")/script')
  })

  it('preserves ampersands and quotes in prose', () => {
    expect(sanitizeContent('Mom & Dad said "hello"')).toBe('Mom & Dad said "hello"')
  })

  it('preserves newlines and formatting', () => {
    expect(sanitizeContent('Line 1\nLine 2')).toBe('Line 1\nLine 2')
  })

  it('strips nested HTML tags', () => {
    expect(sanitizeContent('Hello <b>world</b>')).toBe('Hello bworld/b')
  })
})
