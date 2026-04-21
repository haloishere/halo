import { describe, it, expect } from 'vitest'
import { extractProposal, memoryProposalSchema } from '../proposal-parser.js'

const VALID_JSON = `{"propose":{"topic":"fashion","label":"likes_minimalist","value":"Clean lines, neutral palette"}}`

describe('memoryProposalSchema', () => {
  it('accepts a well-formed proposal', () => {
    const result = memoryProposalSchema.safeParse({
      topic: 'fashion',
      label: 'loves_ramen',
      value: 'Tonkotsu above all',
    })
    expect(result.success).toBe(true)
  })

  it('rejects an unknown topic', () => {
    const result = memoryProposalSchema.safeParse({
      topic: 'finance',
      label: 'x',
      value: 'y',
    })
    expect(result.success).toBe(false)
  })

  it('rejects an empty label', () => {
    const result = memoryProposalSchema.safeParse({
      topic: 'fashion',
      label: '',
      value: 'y',
    })
    expect(result.success).toBe(false)
  })

  it('rejects an empty value', () => {
    const result = memoryProposalSchema.safeParse({
      topic: 'fashion',
      label: 'x',
      value: '',
    })
    expect(result.success).toBe(false)
  })
})

describe('extractProposal — happy path', () => {
  it('extracts a valid proposal from the final line and strips it', () => {
    const text = `Sure, for a weekend outfit I'd pick a cream chunky knit with slim black trousers.\n${VALID_JSON}`
    const result = extractProposal(text)

    expect(result.proposal).toEqual({
      topic: 'fashion',
      label: 'likes_minimalist',
      value: 'Clean lines, neutral palette',
    })
    expect(result.cleanedText).toBe(
      `Sure, for a weekend outfit I'd pick a cream chunky knit with slim black trousers.`,
    )
  })

  it('tolerates trailing whitespace after the JSON line', () => {
    const text = `Reply.\n${VALID_JSON}\n   \n`
    const result = extractProposal(text)
    expect(result.proposal).not.toBeNull()
    expect(result.cleanedText).toBe('Reply.')
  })

  it('returns cleanedText as empty when the entire output is just the JSON line', () => {
    const result = extractProposal(VALID_JSON)
    expect(result.proposal).not.toBeNull()
    expect(result.cleanedText).toBe('')
  })
})

describe('extractProposal — no-op paths', () => {
  it('returns proposal:null for empty input', () => {
    const result = extractProposal('')
    expect(result).toEqual({ proposal: null, cleanedText: '' })
  })

  it('returns proposal:null when there is no JSON line at the end', () => {
    const text = `Just some reply without a proposal.`
    const result = extractProposal(text)
    expect(result.proposal).toBeNull()
    expect(result.cleanedText).toBe(text)
  })

  it('preserves the original text when the last line is malformed JSON', () => {
    const text = `Reply.\n{"propose":{"topic":"fashion","label":`
    const result = extractProposal(text)
    expect(result.proposal).toBeNull()
    expect(result.cleanedText).toBe(text)
  })

  it('rejects a proposal with an unknown topic (preserves text)', () => {
    const text = `Reply.\n{"propose":{"topic":"finance","label":"x","value":"y"}}`
    const result = extractProposal(text)
    expect(result.proposal).toBeNull()
    expect(result.cleanedText).toBe(text)
  })

  it('rejects a proposal missing a required field (preserves text)', () => {
    const text = `Reply.\n{"propose":{"topic":"fashion","label":"x"}}`
    const result = extractProposal(text)
    expect(result.proposal).toBeNull()
    expect(result.cleanedText).toBe(text)
  })

  it('rejects JSON when more text follows on a later line (only final-line JSON counts)', () => {
    // Regression guard — a clever model could emit the JSON mid-reply and
    // continue after. That isn't a valid "end-of-turn proposal".
    const text = `${VALID_JSON}\nmore chatter after the proposal`
    const result = extractProposal(text)
    expect(result.proposal).toBeNull()
    expect(result.cleanedText).toBe(text)
  })

  it('rejects a non-propose JSON object on the final line', () => {
    const text = `Reply.\n{"other":{"key":"value"}}`
    const result = extractProposal(text)
    expect(result.proposal).toBeNull()
    expect(result.cleanedText).toBe(text)
  })
})
