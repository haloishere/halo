import type { AiClient, AiContent } from '../../lib/vertex-ai.js'

// Heuristic: ~4 characters per token is a reasonable approximation for English text
const CHARS_PER_TOKEN = 4

/**
 * Estimate token count from text length (~4 chars per token).
 * Note: streaming.service.ts uses an inline version of this heuristic.
 * TODO: Replace inline heuristic with this function.
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}

/**
 * Accurate token count via Vertex AI countTokens API.
 * Use for post-response recording of actual usage.
 */
export async function countTokensViaApi(client: AiClient, contents: AiContent[]): Promise<number> {
  const result = await client.countTokens(contents)
  return result.totalTokens
}
