import { describe, it, expect, vi } from 'vitest'
import { memoryProposalSchema } from '@halo/shared'
import { extractProposal } from '../proposal-parser.js'

function makeSilentLogger() {
  const logger = {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn(() => logger),
    level: 'silent' as const,
  }
  return logger
}

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

describe('extractProposal — multiple trailing proposal lines', () => {
  it('strips ALL trailing proposal lines and returns the last valid one', () => {
    const line1 = `{"propose":{"topic":"fashion","label":"preferred_fabrics","value":"wool blends"}}`
    const line2 = `{"propose":{"topic":"fashion","label":"fit_preference","value":"slim fit"}}`
    const text = `Great choices!\n${line1}\n${line2}`
    const result = extractProposal(text)

    expect(result.proposal).toEqual({
      topic: 'fashion',
      label: 'fit_preference',
      value: 'slim fit',
    })
    expect(result.cleanedText).toBe('Great choices!')
  })

  it('strips all trailing proposal lines when the entire text is only proposals', () => {
    const line1 = `{"propose":{"topic":"food_and_restaurants","label":"cuisine","value":"Italian"}}`
    const line2 = `{"propose":{"topic":"food_and_restaurants","label":"diet","value":"vegetarian"}}`
    const result = extractProposal(`${line1}\n${line2}`)

    expect(result.proposal).not.toBeNull()
    expect(result.cleanedText).toBe('')
  })

  it('stops stripping at the first non-proposal line from the bottom', () => {
    const proposal = `{"propose":{"topic":"fashion","label":"style","value":"minimalist"}}`
    const text = `Line one.\nLine two.\n${proposal}`
    const result = extractProposal(text)

    expect(result.cleanedText).toBe('Line one.\nLine two.')
  })
})

describe('extractProposal — optional logger telemetry', () => {
  it('does NOT log when there is no proposal line (common case)', () => {
    const logger = makeSilentLogger()
    extractProposal('Just a normal reply.', logger)
    expect(logger.warn).not.toHaveBeenCalled()
    expect(logger.error).not.toHaveBeenCalled()
  })

  it('warns with json_error when the final line starts like `{"propose":` but fails to parse', () => {
    const logger = makeSilentLogger()
    extractProposal('Reply.\n{"propose":{"topic":"fashion","label":', logger)
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'json_error' }),
      expect.stringContaining('proposal.parser'),
    )
  })

  it('warns with schema_error when the final line parses but fails Zod validation', () => {
    const logger = makeSilentLogger()
    extractProposal('Reply.\n{"propose":{"topic":"finance","label":"x","value":"y"}}', logger)
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'schema_error' }),
      expect.stringContaining('proposal.parser'),
    )
  })

  it('does NOT log on the happy path (successful extraction)', () => {
    const logger = makeSilentLogger()
    extractProposal(
      'Reply.\n{"propose":{"topic":"fashion","label":"loves_minimalist","value":"Clean lines"}}',
      logger,
    )
    expect(logger.warn).not.toHaveBeenCalled()
    expect(logger.error).not.toHaveBeenCalled()
  })
})
