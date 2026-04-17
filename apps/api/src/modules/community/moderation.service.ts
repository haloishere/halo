import type { FastifyBaseLogger } from 'fastify'
import type { AiClient } from '../../lib/vertex-ai.js'
import { classifyInput } from '../ai-chat/safety/input-classifier.js'
import { MODERATION_PROMPT } from './moderation-prompt.js'

export type ModerationCategory = 'phi' | 'crisis' | 'spam' | 'harmful'

export type ModerationResult =
  | { approved: true }
  | { approved: false; reason: string; category: ModerationCategory }

const MODERATION_TIMEOUT_MS = 5_000
const VALID_CATEGORIES = new Set<ModerationCategory>(['phi', 'crisis', 'spam', 'harmful'])

export async function moderateContent(
  aiClient: AiClient,
  text: string,
  logger?: FastifyBaseLogger,
): Promise<ModerationResult> {
  // Layer 0: fast regex screening for prompt injection
  const inputCheck = classifyInput(text)
  if (!inputCheck.safe) {
    logger?.warn(
      { category: inputCheck.category, reason: inputCheck.reason },
      'Prompt injection detected in community content',
    )
    return { approved: false, reason: 'Content flagged: harmful', category: 'harmful' }
  }

  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const timeoutPromise = new Promise<ModerationResult>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Moderation timeout')), MODERATION_TIMEOUT_MS)
    })
    const result = await Promise.race([runModeration(aiClient, text), timeoutPromise])
    return result
  } catch (err) {
    logger?.warn({ err }, 'Community moderation failed open — content will be published')
    return { approved: true }
  } finally {
    clearTimeout(timer)
  }
}

async function runModeration(aiClient: AiClient, text: string): Promise<ModerationResult> {
  const response = await aiClient.generateContent(MODERATION_PROMPT, [
    { role: 'user', parts: [{ text: `<USER_CONTENT>\n${text}\n</USER_CONTENT>` }] },
  ])

  const classification = response.trim()

  if (classification === 'APPROVED') {
    return { approved: true }
  }

  const match = classification.match(/^FLAGGED\|(\w+)$/)
  if (match) {
    const category = match[1] as string
    if (VALID_CATEGORIES.has(category as ModerationCategory)) {
      return {
        approved: false,
        reason: `Content flagged: ${category}`,
        category: category as ModerationCategory,
      }
    }
  }

  // Unrecognized output — fail open
  return { approved: true }
}
