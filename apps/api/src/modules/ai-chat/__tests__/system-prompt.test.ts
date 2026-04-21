import { describe, it, expect } from 'vitest'
import { buildSystemPrompt, sanitizeForPrompt } from '../system-prompt.js'

describe('sanitizeForPrompt', () => {
  it('strips control characters (C0) and zero-width formatters', () => {
    // BEL (U+0007) is a C0 control, ZWSP (U+200B) is a format char. Both
    // match the `[\p{Cc}\p{Cf}]` class the sanitiser removes. Escape
    // sequences instead of literals so `no-irregular-whitespace` doesn't
    // flag the source file.
    const s = sanitizeForPrompt('Hello​World')
    expect(s).toBe('HelloWorld')
  })

  it('strips newlines and trims surrounding whitespace', () => {
    expect(sanitizeForPrompt('  Hello World\n  ')).toBe('Hello World')
  })

  it('caps at 80 chars', () => {
    expect(sanitizeForPrompt('a'.repeat(120))).toHaveLength(80)
  })
})

describe('buildSystemPrompt — topic scoping', () => {
  it('labels the vault section with the current topic when provided', () => {
    const prompt = buildSystemPrompt({
      displayName: 'Alex',
      topic: 'fashion',
      vaultEntries: [{ label: 'style', value: 'minimalist' }],
    })
    expect(prompt).toMatch(/fashion/i)
    expect(prompt).toContain('minimalist')
  })

  it('falls back to a generic section label when no topic is supplied', () => {
    const prompt = buildSystemPrompt({
      displayName: 'Alex',
      vaultEntries: [{ label: 'style', value: 'minimalist' }],
    })
    // Should still render the vault entries even without a topic.
    expect(prompt).toContain('minimalist')
  })

  it('omits the vault section entirely when there are no entries', () => {
    const prompt = buildSystemPrompt({ displayName: 'Alex', topic: 'fashion', vaultEntries: [] })
    expect(prompt).not.toMatch(/What the vault/i)
  })
})

describe('buildSystemPrompt — PROPOSAL_HOOK topic awareness', () => {
  it('PROPOSAL_HOOK mentions all three topic enum values so the LLM can pick the right one', () => {
    const prompt = buildSystemPrompt({ displayName: 'Alex' })
    expect(prompt).toContain('food_and_restaurants')
    expect(prompt).toContain('fashion')
    expect(prompt).toContain('lifestyle_and_travel')
  })

  it('PROPOSAL_HOOK shows the topic key in the JSON shape', () => {
    const prompt = buildSystemPrompt({ displayName: 'Alex' })
    // Must include a sample JSON that requires `"topic":` so the model
    // always emits the discriminator.
    expect(prompt).toMatch(/"topic"/)
    expect(prompt).toMatch(/"label"/)
    expect(prompt).toMatch(/"value"/)
  })
})

describe('buildSystemPrompt — base sections (existing)', () => {
  it('always includes PERSONA and BOUNDARIES', () => {
    const prompt = buildSystemPrompt({})
    expect(prompt).toMatch(/You are Halo/)
    expect(prompt).toMatch(/BOUNDARIES/)
  })

  it('renders displayName and city when provided', () => {
    const prompt = buildSystemPrompt({ displayName: 'Jane', city: 'Berlin' })
    expect(prompt).toContain('Jane')
    expect(prompt).toContain('Berlin')
  })

  it('includes GROUNDING only when ragEnabled is true', () => {
    const withoutRag = buildSystemPrompt({ displayName: 'Alex' })
    const withRag = buildSystemPrompt({ displayName: 'Alex' }, { ragEnabled: true })
    expect(withoutRag).not.toMatch(/KNOWLEDGE BASE/)
    expect(withRag).toMatch(/KNOWLEDGE BASE/)
  })
})
