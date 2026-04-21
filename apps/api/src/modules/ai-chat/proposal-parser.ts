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
 * Extract a final-line memory proposal from an assistant turn's text.
 *
 * Tolerant by design: malformed JSON, unknown topic, or a missing field all
 * return `{ proposal: null, cleanedText: <original> }`. The caller would
 * rather persist the raw turn than drop it because the model hallucinated.
 * When a `logger` is passed, parse failures that looked intentional
 * (prefix matched, but JSON or schema validation failed) are logged at
 * `warn` so operators notice LLM drift. No-proposal-line is the common
 * case and stays silent.
 */
export function extractProposal(
  text: string,
  logger?: FastifyBaseLogger,
): ProposalExtractionResult {
  if (!text) return { proposal: null, cleanedText: text }

  const trimmedTail = text.replace(/\s+$/, '')
  if (!trimmedTail) return { proposal: null, cleanedText: text }

  const lastNewline = trimmedTail.lastIndexOf('\n')
  const lastLine = lastNewline === -1 ? trimmedTail : trimmedTail.slice(lastNewline + 1)

  if (!PROPOSE_PREFIX.test(lastLine)) {
    return { proposal: null, cleanedText: text }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(lastLine)
  } catch (err) {
    logger?.warn(
      { kind: 'json_error', err, lastLine: lastLine.slice(0, 200) },
      'proposal.parser.failed',
    )
    return { proposal: null, cleanedText: text }
  }

  if (!parsed || typeof parsed !== 'object' || !('propose' in parsed)) {
    logger?.warn({ kind: 'schema_error' }, 'proposal.parser.failed')
    return { proposal: null, cleanedText: text }
  }

  const result = memoryProposalSchema.safeParse((parsed as { propose: unknown }).propose)
  if (!result.success) {
    logger?.warn(
      { kind: 'schema_error', issues: result.error.issues },
      'proposal.parser.failed',
    )
    return { proposal: null, cleanedText: text }
  }

  const cleanedText = lastNewline === -1 ? '' : text.slice(0, lastNewline).replace(/\s+$/, '')
  return { proposal: result.data, cleanedText }
}
