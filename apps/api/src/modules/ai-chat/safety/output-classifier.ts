import type { FastifyBaseLogger } from 'fastify'
import type { AiClient } from '../../../lib/vertex-ai.js'

export type OutputClassification =
  | { safe: true }
  | {
      safe: false
      reason: string
      category: 'medical_advice' | 'harmful_content' | 'identity_violation'
    }

const OUTPUT_CHECK_TIMEOUT_MS = 5_000

const CLASSIFICATION_PROMPT = `You are a safety classifier for a dementia caregiver support chatbot called Halo.

Analyze the following AI response and determine if it:
1. Provides specific medical advice (diagnoses, medication dosages, treatment plans) — UNSAFE
2. Claims to be a doctor, nurse, or licensed healthcare professional — UNSAFE
3. Contains harmful, abusive, or discriminatory content — UNSAFE
4. Contains appropriate caregiver support, emotional validation, or general wellness tips — SAFE

Respond with EXACTLY one word: SAFE or UNSAFE
If UNSAFE, add a pipe and the category: UNSAFE|medical_advice or UNSAFE|harmful_content or UNSAFE|identity_violation`

/**
 * Layer 3: Post-generation output classification via separate Gemini call.
 * Fails OPEN on timeout — Gemini's built-in safety is the primary defense.
 */
export async function classifyOutput(
  aiClient: AiClient,
  response: string,
  logger?: FastifyBaseLogger,
): Promise<OutputClassification> {
  try {
    const result = await Promise.race([
      runClassification(aiClient, response),
      timeout(OUTPUT_CHECK_TIMEOUT_MS),
    ])

    return result
  } catch (err) {
    logger?.warn({ err }, 'Output classifier failed open — trusting Gemini built-in safety')
    return { safe: true }
  }
}

async function runClassification(
  aiClient: AiClient,
  response: string,
): Promise<OutputClassification> {
  const chunks: string[] = []
  for await (const chunk of aiClient.generateContentStream(CLASSIFICATION_PROMPT, [
    { role: 'user', parts: [{ text: response }] },
  ])) {
    chunks.push(chunk.text)
  }

  const classification = chunks.join('').trim()

  if (classification.startsWith('SAFE')) {
    return { safe: true }
  }

  if (classification.startsWith('UNSAFE')) {
    const parts = classification.split('|')
    type UnsafeOutput = Extract<OutputClassification, { safe: false }>
    const category = (parts[1]?.trim() ?? 'harmful_content') as UnsafeOutput['category']
    return {
      safe: false,
      reason: `Output classified as unsafe: ${category}`,
      category,
    }
  }

  // Unrecognized output — fail open
  return { safe: true }
}

function timeout(ms: number): Promise<OutputClassification> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Classification timeout')), ms)
  })
}
