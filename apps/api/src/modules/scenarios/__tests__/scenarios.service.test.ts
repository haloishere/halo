import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { QuestionnaireAnswers } from '@halo/shared'

// ── Mock Vertex AI before import ──────────────────────────────────────────────

const { mockGenerateContent } = vi.hoisted(() => ({
  mockGenerateContent: vi.fn(),
}))

vi.mock('../../../lib/vertex-ai.js', () => ({
  getAiClient: () => ({ generateContent: mockGenerateContent }),
}))

const { buildFollowupsPrompt, buildSubmitPrompt, generateFollowups, generateProposals } =
  await import('../scenarios.service.js')

// ── Prompt builder tests ──────────────────────────────────────────────────────

describe('buildFollowupsPrompt', () => {
  const answers: QuestionnaireAnswers = {
    food_diet: { chips: ['Vegetarian'], freeText: 'also mostly dairy-free' },
    food_cuisine: { chips: ['Japanese', 'Indian'] },
  }

  it('includes the topic name', () => {
    const prompt = buildFollowupsPrompt('food_and_restaurants', answers)
    expect(prompt).toContain('food_and_restaurants')
  })

  it('includes the user answers verbatim', () => {
    const prompt = buildFollowupsPrompt('food_and_restaurants', answers)
    expect(prompt).toContain('Vegetarian')
    expect(prompt).toContain('dairy-free')
    expect(prompt).toContain('Japanese')
  })

  it('does NOT contain vault ciphertext indicators (enc: prefix)', () => {
    const prompt = buildFollowupsPrompt('food_and_restaurants', answers)
    expect(prompt).not.toContain('enc:')
  })
})

describe('buildSubmitPrompt', () => {
  const answers: QuestionnaireAnswers = {
    food_diet: { chips: ['Vegan'] },
    food_vibe: { chips: ['Street food', 'Casual'] },
  }

  it('includes the topic', () => {
    const prompt = buildSubmitPrompt('food_and_restaurants', answers)
    expect(prompt).toContain('food_and_restaurants')
  })

  it('includes the user answers', () => {
    const prompt = buildSubmitPrompt('food_and_restaurants', answers)
    expect(prompt).toContain('Vegan')
    expect(prompt).toContain('Street food')
  })

  it('instructs the model to output valid JSON proposals', () => {
    const prompt = buildSubmitPrompt('food_and_restaurants', answers)
    expect(prompt.toLowerCase()).toMatch(/json|proposal/)
  })
})

// ── generateFollowups ─────────────────────────────────────────────────────────

describe('generateFollowups', () => {
  const answers: QuestionnaireAnswers = {
    food_diet: { chips: ['Vegetarian'] },
  }

  beforeEach(() => {
    mockGenerateContent.mockResolvedValue(
      JSON.stringify([
        { id: 'follow_1', prompt: 'Any favourite restaurants?', chips: ['Yes', 'No'], allowFreeText: true },
      ]),
    )
  })

  it('calls generateContent and returns parsed Question[]', async () => {
    const followups = await generateFollowups('food_and_restaurants', answers)
    expect(followups).toHaveLength(1)
    expect(followups[0]).toMatchObject({
      id: 'follow_1',
      prompt: expect.any(String),
      chips: expect.any(Array),
      allowFreeText: expect.any(Boolean),
    })
  })

  it('returns [] if the model returns an empty array', async () => {
    mockGenerateContent.mockResolvedValue('[]')
    const followups = await generateFollowups('food_and_restaurants', answers)
    expect(followups).toEqual([])
  })

  it('returns [] if the model response is not parseable JSON', async () => {
    mockGenerateContent.mockResolvedValue('sorry, I cannot help with that')
    const followups = await generateFollowups('food_and_restaurants', answers)
    expect(followups).toEqual([])
  })
})

// ── generateProposals ─────────────────────────────────────────────────────────

describe('generateProposals', () => {
  const answers: QuestionnaireAnswers = {
    food_diet: { chips: ['Vegan'] },
    food_cuisine: { chips: ['Thai'] },
  }

  beforeEach(() => {
    mockGenerateContent.mockResolvedValue(
      JSON.stringify([
        { topic: 'food_and_restaurants', label: 'vegan', value: 'Follows a vegan diet' },
        { topic: 'food_and_restaurants', label: 'thai_cuisine', value: 'Loves Thai food' },
      ]),
    )
  })

  it('returns validated MemoryProposal[]', async () => {
    const proposals = await generateProposals('food_and_restaurants', answers)
    expect(proposals).toHaveLength(2)
    for (const p of proposals) {
      expect(p).toMatchObject({
        topic: 'food_and_restaurants',
        label: expect.any(String),
        value: expect.any(String),
      })
    }
  })

  it('strips proposals with a mismatched topic', async () => {
    mockGenerateContent.mockResolvedValue(
      JSON.stringify([
        { topic: 'fashion', label: 'wrong_topic', value: 'This should be filtered out' },
        { topic: 'food_and_restaurants', label: 'correct', value: 'Vegan' },
      ]),
    )
    const proposals = await generateProposals('food_and_restaurants', answers)
    expect(proposals.every((p) => p.topic === 'food_and_restaurants')).toBe(true)
    expect(proposals).toHaveLength(1)
  })

  it('returns [] on unparseable model response', async () => {
    mockGenerateContent.mockResolvedValue('not json at all')
    const proposals = await generateProposals('food_and_restaurants', answers)
    expect(proposals).toEqual([])
  })
})
