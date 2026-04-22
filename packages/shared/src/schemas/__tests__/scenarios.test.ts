import { describe, it, expect } from 'vitest'
import {
  questionSchema,
  questionAnswerSchema,
  questionnaireAnswersSchema,
  questionnaireAnswersRequestSchema,
  questionnaireFollowupsResponseSchema,
  questionnaireSubmitResponseSchema,
} from '../../index'

describe('questionSchema', () => {
  const valid = {
    id: 'q_cuisine',
    prompt: 'What cuisines do you enjoy?',
    chips: ['Italian', 'Japanese'],
    allowFreeText: true,
  }

  it('accepts a well-formed question', () => {
    expect(questionSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects empty id', () => {
    expect(questionSchema.safeParse({ ...valid, id: '' }).success).toBe(false)
  })

  it('rejects empty prompt', () => {
    expect(questionSchema.safeParse({ ...valid, prompt: '' }).success).toBe(false)
  })

  it('accepts an empty chips array', () => {
    expect(questionSchema.safeParse({ ...valid, chips: [] }).success).toBe(true)
  })
})

describe('questionAnswerSchema', () => {
  it('accepts a valid answer with chips only', () => {
    expect(questionAnswerSchema.safeParse({ chips: ['Italian'] }).success).toBe(true)
  })

  it('accepts a valid answer with chips and freeText', () => {
    expect(questionAnswerSchema.safeParse({ chips: ['Sushi'], freeText: 'no spice' }).success).toBe(
      true,
    )
  })

  it('accepts an empty chips array', () => {
    expect(questionAnswerSchema.safeParse({ chips: [] }).success).toBe(true)
  })

  it('rejects a chip that exceeds 100 chars', () => {
    const longChip = 'a'.repeat(101)
    expect(questionAnswerSchema.safeParse({ chips: [longChip] }).success).toBe(false)
  })

  it('rejects more than 20 chips', () => {
    const chips = Array.from({ length: 21 }, (_, i) => `chip${i}`)
    expect(questionAnswerSchema.safeParse({ chips }).success).toBe(false)
  })

  it('rejects freeText longer than 300 chars', () => {
    const longText = 'a'.repeat(301)
    expect(questionAnswerSchema.safeParse({ chips: [], freeText: longText }).success).toBe(false)
  })
})

describe('questionnaireAnswersSchema', () => {
  const oneAnswer = { chips: ['Italian'], freeText: 'tonkotsu ramen' }

  it('accepts a record with valid entries', () => {
    const result = questionnaireAnswersSchema.safeParse({ q1: oneAnswer, q2: { chips: [] } })
    expect(result.success).toBe(true)
  })

  it('accepts exactly 10 answers (at the limit)', () => {
    const tenAnswers = Object.fromEntries(
      Array.from({ length: 10 }, (_, i) => [`q${i}`, { chips: [] }]),
    )
    expect(questionnaireAnswersSchema.safeParse(tenAnswers).success).toBe(true)
  })

  it('rejects 11 answers (over the refine cap)', () => {
    const elevenAnswers = Object.fromEntries(
      Array.from({ length: 11 }, (_, i) => [`q${i}`, { chips: [] }]),
    )
    const result = questionnaireAnswersSchema.safeParse(elevenAnswers)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('Too many answers (max 10)')
    }
  })

  it('accepts an empty record', () => {
    expect(questionnaireAnswersSchema.safeParse({}).success).toBe(true)
  })
})

describe('questionnaireAnswersRequestSchema', () => {
  it('accepts a valid answers payload', () => {
    const payload = { answers: { q1: { chips: ['Ramen'] } } }
    expect(questionnaireAnswersRequestSchema.safeParse(payload).success).toBe(true)
  })

  it('rejects missing answers field', () => {
    expect(questionnaireAnswersRequestSchema.safeParse({}).success).toBe(false)
  })
})

describe('questionnaireFollowupsResponseSchema', () => {
  it('accepts an empty followups array', () => {
    expect(questionnaireFollowupsResponseSchema.safeParse({ followups: [] }).success).toBe(true)
  })

  it('accepts followups with valid questions', () => {
    const q = { id: 'fq1', prompt: 'Budget?', chips: ['<€20', '€20-50'], allowFreeText: false }
    expect(questionnaireFollowupsResponseSchema.safeParse({ followups: [q] }).success).toBe(true)
  })
})

describe('questionnaireSubmitResponseSchema', () => {
  it('accepts an empty proposals array', () => {
    expect(questionnaireSubmitResponseSchema.safeParse({ proposals: [] }).success).toBe(true)
  })

  it('accepts proposals matching memoryProposalSchema', () => {
    const proposal = {
      topic: 'food_and_restaurants',
      label: 'loves_ramen',
      value: 'Prefers tonkotsu over miso',
    }
    expect(
      questionnaireSubmitResponseSchema.safeParse({ proposals: [proposal] }).success,
    ).toBe(true)
  })
})
