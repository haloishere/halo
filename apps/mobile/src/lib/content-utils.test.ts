import { describe, it, expect } from 'vitest'
import { getCategoryLabel, getSnippet, formatReadTime } from './content-utils'

describe('getCategoryLabel', () => {
  it('maps understanding_disease to readable label', () => {
    expect(getCategoryLabel('understanding_disease')).toBe('Understanding the Disease')
  })

  it('maps daily_care', () => {
    expect(getCategoryLabel('daily_care')).toBe('Daily Care')
  })

  it('maps behavioral_management', () => {
    expect(getCategoryLabel('behavioral_management')).toBe('Behavioral Management')
  })

  it('maps communication', () => {
    expect(getCategoryLabel('communication')).toBe('Communication')
  })

  it('maps safety', () => {
    expect(getCategoryLabel('safety')).toBe('Safety')
  })

  it('maps self_care', () => {
    expect(getCategoryLabel('self_care')).toBe('Self Care')
  })

  it('maps legal_financial', () => {
    expect(getCategoryLabel('legal_financial')).toBe('Legal & Financial')
  })
})

describe('getSnippet', () => {
  it('strips markdown headings', () => {
    expect(getSnippet('# Hello\n\nWorld')).toBe('Hello World')
  })

  it('strips bold and italic', () => {
    expect(getSnippet('This is **bold** and *italic*')).toBe('This is bold and italic')
  })

  it('strips links', () => {
    expect(getSnippet('Visit [Google](https://google.com)')).toBe('Visit Google')
  })

  it('truncates at maxLength with ellipsis', () => {
    const long = 'a'.repeat(300)
    const result = getSnippet(long, 200)
    expect(result.length).toBeLessThanOrEqual(203) // 200 + '...'
    expect(result).toMatch(/\.\.\.$/u)
  })

  it('does not truncate short text', () => {
    expect(getSnippet('Short text')).toBe('Short text')
  })
})

describe('formatReadTime', () => {
  it('returns 1 min read for short text', () => {
    expect(formatReadTime('word '.repeat(50))).toBe('1 min read')
  })

  it('returns correct minutes for longer text', () => {
    expect(formatReadTime('word '.repeat(1000))).toBe('5 min read')
  })

  it('returns at least 1 min', () => {
    expect(formatReadTime('hello')).toBe('1 min read')
  })
})
