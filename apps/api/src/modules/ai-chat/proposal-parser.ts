import { z } from 'zod'
import { VAULT_TOPICS } from '@halo/shared'

// Zod schema for the `{"propose": {...}}` payload the LLM emits on its
// final line. Topic, label, value are all required — mirrors the
// PROPOSAL_HOOK wording in `system-prompt.ts`.
export const memoryProposalSchema = z.object({
  topic: z.enum(VAULT_TOPICS),
  label: z.string().min(1).max(100),
  value: z.string().min(1).max(500),
})

export type MemoryProposal = z.infer<typeof memoryProposalSchema>

export interface ProposalExtractionResult {
  proposal: MemoryProposal | null
  /** The assistant text with a parsed proposal line removed. Unchanged if no valid proposal is found. */
  cleanedText: string
}

const PROPOSE_PREFIX = /^\s*\{\s*"propose"\s*:/

/**
 * Extract a final-line memory proposal from an assistant turn's text.
 *
 * Contract:
 * - The JSON must be on the final non-whitespace line. Mid-reply JSON is
 *   ignored — an "end-of-turn proposal" is literally at the end.
 * - Unknown topic / missing required field / malformed JSON → proposal is
 *   null, cleanedText is the original input. Tolerant by design: the caller
 *   would rather save the raw turn than reject it because the model hallucinated
 *   a topic name.
 * - Trailing whitespace after the JSON line is tolerated.
 */
export function extractProposal(text: string): ProposalExtractionResult {
  if (!text) return { proposal: null, cleanedText: text }

  const trimmedTail = text.replace(/\s+$/, '')
  if (!trimmedTail) return { proposal: null, cleanedText: text }

  // Find the last non-empty line. If anything non-whitespace follows the
  // JSON, it's not an end-of-turn proposal.
  const lastNewline = trimmedTail.lastIndexOf('\n')
  const lastLine = lastNewline === -1 ? trimmedTail : trimmedTail.slice(lastNewline + 1)

  if (!PROPOSE_PREFIX.test(lastLine)) {
    return { proposal: null, cleanedText: text }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(lastLine)
  } catch {
    return { proposal: null, cleanedText: text }
  }

  if (!parsed || typeof parsed !== 'object' || !('propose' in parsed)) {
    return { proposal: null, cleanedText: text }
  }

  const result = memoryProposalSchema.safeParse((parsed as { propose: unknown }).propose)
  if (!result.success) {
    return { proposal: null, cleanedText: text }
  }

  // Strip the proposal line and any trailing whitespace. Keep body whitespace
  // intact so the saved message still reads naturally.
  const cleanedText = lastNewline === -1 ? '' : text.slice(0, lastNewline).replace(/\s+$/, '')

  return { proposal: result.data, cleanedText }
}
