import type { FastifyBaseLogger } from 'fastify'
import { memoryProposalSchema, type MemoryProposal } from '@halo/shared'

export { memoryProposalSchema, type MemoryProposal } from '@halo/shared'

export interface ProposalExtractionResult {
  proposal: MemoryProposal | null
  /** The assistant text with a parsed proposal line removed. Unchanged if no valid proposal is found. */
  cleanedText: string
}

// Matches the opening of a valid propose-line: optional whitespace, `{`,
// optional whitespace, `"propose"`, optional whitespace, `:`. Intentionally
// permissive on surrounding whitespace; do NOT tighten this without a
// regression test documenting the real LLM output shape you're gating on.
const PROPOSE_PREFIX = /^\s*\{\s*"propose"\s*:/

/**
 * Extract memory proposal(s) from the trailing lines of an assistant turn.
 *
 * Gemini occasionally emits more than one `{"propose":...}` line at the end
 * of a turn. This function strips ALL consecutive trailing proposal lines and
 * returns the last valid one (the model's most recent intent). Tolerant by
 * design: malformed JSON, unknown topic, or a missing field all return
 * `{ proposal: null, cleanedText: <original> }`. Parse failures that looked
 * intentional (prefix matched but JSON/schema failed) are logged at `warn`.
 */
export function extractProposal(
  text: string,
  logger?: FastifyBaseLogger,
): ProposalExtractionResult {
  if (!text) return { proposal: null, cleanedText: text }

  const trimmedTail = text.replace(/\s+$/, '')
  if (!trimmedTail) return { proposal: null, cleanedText: text }

  // Split into lines and walk backwards, peeling off every trailing line that
  // looks like a propose block. Stop as soon as we hit a non-proposal line.
  const lines = trimmedTail.split('\n')
  let lastValidProposal: MemoryProposal | null = null
  let strippedCount = 0

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]
    if (!PROPOSE_PREFIX.test(line)) break

    let parsed: unknown
    try {
      parsed = JSON.parse(line)
    } catch (err) {
      logger?.warn(
        { kind: 'json_error', err, lastLine: line.slice(0, 200) },
        'proposal.parser.failed',
      )
      // Malformed JSON: stop scanning — treat everything from here down as content.
      break
    }

    if (!parsed || typeof parsed !== 'object' || !('propose' in parsed)) {
      logger?.warn({ kind: 'schema_error' }, 'proposal.parser.failed')
      break
    }

    const result = memoryProposalSchema.safeParse((parsed as { propose: unknown }).propose)
    if (!result.success) {
      logger?.warn({ kind: 'schema_error', issues: result.error.issues }, 'proposal.parser.failed')
      break
    }

    // First valid proposal we encounter (walking from the bottom) is the last one emitted.
    if (lastValidProposal === null) {
      lastValidProposal = result.data
    }
    strippedCount++
  }

  if (lastValidProposal === null) {
    return { proposal: null, cleanedText: text }
  }

  const keepLines = lines.slice(0, lines.length - strippedCount)
  const cleanedText = keepLines.join('\n').replace(/\s+$/, '')
  return { proposal: lastValidProposal, cleanedText }
}
