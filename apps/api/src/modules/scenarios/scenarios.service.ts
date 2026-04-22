import type { FastifyBaseLogger } from 'fastify'
import type { VaultTopic, QuestionnaireAnswers, Question, MemoryProposal } from '@halo/shared'
import { questionSchema, memoryProposalSchema, QUESTIONNAIRES } from '@halo/shared'
import { getAiClient } from '../../lib/vertex-ai.js'

// ── Prompt builders (exported for unit-testing) ───────────────────────────────

export function buildFollowupsPrompt(topic: VaultTopic, answers: QuestionnaireAnswers): string {
  const lines = Object.entries(answers)
    .map(([qId, a]) => {
      const chips = a.chips.join(', ')
      const free = a.freeText ? `; also: ${a.freeText}` : ''
      return `  ${qId}: ${chips}${free}`
    })
    .join('\n')

  return `You are helping Halo build a personal memory profile for the "${topic}" scenario.

The user answered these questions about their preferences:
${lines}

Generate exactly 1 follow-up question that digs deeper into a preference gap not yet covered.
Return a JSON array with one object matching this shape exactly (no markdown, no explanation):
[{"id":"<snake_case_id>","prompt":"<question text>","chips":["<option1>","<option2>"],"allowFreeText":<true|false>}]`
}

export function buildSubmitPrompt(topic: VaultTopic, answers: QuestionnaireAnswers): string {
  const lines = Object.entries(answers)
    .map(([qId, a]) => {
      const chips = a.chips.join(', ')
      const free = a.freeText ? `; also: ${a.freeText}` : ''
      return `  ${qId}: ${chips}${free}`
    })
    .join('\n')

  return `You are extracting structured memories for Halo's "${topic}" vault from a user questionnaire.

The user's answers:
${lines}

Consolidate these into 3–4 concise, factual memory proposals. Each proposal must:
- Use topic "${topic}" exactly
- Have a short snake_case label (max 30 chars)
- Have a brief value describing the preference (max 200 chars)

Return a JSON array with no markdown fences:
[{"topic":"${topic}","label":"<label>","value":"<value>"}, ...]`
}

// ── JSON extraction helper ────────────────────────────────────────────────────

function extractJson(raw: string): unknown {
  // Strip optional markdown code fences (```json ... ```)
  const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  return JSON.parse(stripped)
}

// ── generateFollowups ─────────────────────────────────────────────────────────

export async function generateFollowups(
  topic: VaultTopic,
  answers: QuestionnaireAnswers,
  logger?: FastifyBaseLogger,
): Promise<Question[]> {
  const prompt = buildFollowupsPrompt(topic, answers)
  try {
    const raw = await getAiClient().generateContent(
      'You are a helpful questionnaire assistant. Always respond with valid JSON only.',
      [{ role: 'user', parts: [{ text: prompt }] }],
    )
    const parsed = extractJson(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item) => questionSchema.safeParse(item))
      .filter((r) => r.success)
      .map((r) => (r as { success: true; data: Question }).data)
  } catch (err) {
    logger?.warn({ err, topic }, 'generateFollowups: LLM call failed, returning empty list')
    return []
  }
}

// ── generateProposals ─────────────────────────────────────────────────────────

export async function generateProposals(
  topic: VaultTopic,
  answers: QuestionnaireAnswers,
  logger?: FastifyBaseLogger,
): Promise<MemoryProposal[]> {
  const prompt = buildSubmitPrompt(topic, answers)
  try {
    const raw = await getAiClient().generateContent(
      'You are a helpful memory extraction assistant. Always respond with valid JSON only.',
      [{ role: 'user', parts: [{ text: prompt }] }],
    )
    const parsed = extractJson(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item) => memoryProposalSchema.safeParse(item))
      .filter((r) => r.success)
      .map((r) => (r as { success: true; data: MemoryProposal }).data)
      // Enforce topic invariant — strip any proposal the model tagged with the wrong topic
      .filter((p) => p.topic === topic)
  } catch (err) {
    logger?.warn({ err, topic }, 'generateProposals: LLM call failed, returning empty list')
    return []
  }
}

// ── getQuestionnaire ──────────────────────────────────────────────────────────

export function getQuestionnaire(topic: VaultTopic): Question[] {
  return QUESTIONNAIRES[topic]
}
