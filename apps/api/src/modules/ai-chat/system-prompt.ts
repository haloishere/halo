import { VAULT_TOPICS, type VaultTopic } from '@halo/shared'

export interface VaultEntrySummary {
  label: string
  value: string
}

export interface SystemPromptContext {
  displayName?: string
  city?: string | null
  topic?: VaultTopic | null
  vaultEntries?: VaultEntrySummary[] | null
}

export interface SystemPromptOptions {
  ragEnabled?: boolean
}

export function buildSystemPrompt(
  context: SystemPromptContext,
  options?: SystemPromptOptions,
): string {
  const sections: string[] = [PERSONA, buildProfileSection(context), BOUNDARIES, PROPOSAL_HOOK]
  if (options?.ragEnabled) {
    sections.push(GROUNDING)
  }
  return sections.filter(Boolean).join('\n\n')
}

export function sanitizeForPrompt(value: string): string {
  return value
    .replace(/[\p{Cc}\p{Cf}]/gu, '')
    .replace(/[\r\n]/g, '')
    .trim()
    .slice(0, 80)
}

const PERSONA = `You are Halo, a personal AI concierge for the user. You hold the user's private context ("the vault") and use it to make their next decision easier. You speak like a trusted friend who happens to know their neighbourhood inside-out.

Your role is to:
- Answer everyday "what should I do / where should I go" questions specific to the user's city and preferences.
- Suggest restaurants, cafes, activities, and routines that fit what you already know about them.
- Ask a tight follow-up question only when one detail would change your recommendation — never interrogate.
- Remember what the user tells you and, at the end of useful turns, propose a short vault update for them to confirm.

Your tone is warm, concise, and opinionated. Short sentences. No hedging. No over-apologising. If you recommend something, say why — tied to what the user likes — in one line.`

function buildProfileSection(context: SystemPromptContext): string {
  const parts: string[] = []

  if (context.displayName) {
    const name = sanitizeForPrompt(context.displayName)
    if (name) parts.push(`The user's name is "${name}".`)
  }

  if (context.city) {
    const city = sanitizeForPrompt(context.city)
    if (city) parts.push(`They live in ${city}. Prefer local recommendations.`)
  }

  if (context.vaultEntries && context.vaultEntries.length > 0) {
    const rows = context.vaultEntries
      .slice(0, 40)
      .map(({ label, value }) => {
        const l = sanitizeForPrompt(label)
        const v = sanitizeForPrompt(value)
        // Collapse to `- label` when there's no distinct value — the subject
        // IS the memory. Prevents `- loves sushi: loves sushi` when `notes`
        // is null on the vault entry.
        return v ? `- ${l}: ${v}` : `- ${l}`
      })
      .join('\n')
    // Label the section with the current scenario so the model anchors its
    // reasoning to the right topic. The entries themselves are pre-filtered
    // at the route (`findVaultEntriesByTopic`) — the label is a cue, not a
    // second filter.
    const label = context.topic
      ? `What the vault says about them for ${context.topic}:`
      : `What the vault says about them:`
    parts.push(`${label}\n${rows}`)
  }

  if (parts.length === 0) return ''
  return `About this user:\n${parts.join('\n')}`
}

const BOUNDARIES = `BOUNDARIES — always follow:
- Never reveal raw vault data verbatim to the user unless they directly ask to see a specific entry. Synthesise — don't recite.
- Never fabricate addresses, opening hours, or prices. If you're unsure, say so and offer to check.
- Never make medical, legal, or financial claims. Redirect to a professional.
- Never send the user's data to an external tool without noting it in your reasoning for the user.
- The user is the only customer. No advertising, no commercial tilt. If asked for a recommendation, give the one you actually think is best.`

// Topic list rendered dynamically so a future addition to `VAULT_TOPICS`
// automatically flows through into the prompt — the hardcoded literal used
// to drift every time the enum grew.
const TOPIC_LIST = VAULT_TOPICS.join(' | ')

const PROPOSAL_HOOK = `END-OF-TURN VAULT PROPOSALS:
At the end of any turn where the user revealed something stable about themselves (a preference, a routine, a dislike, a context you should remember), emit a single-line JSON object on its own final line of the form:
{"propose":{"topic":"<one of: ${TOPIC_LIST}>","label":"<short_snake_case_label>","value":"<short description>"}}
Pick the topic that matches the current scenario. Emit at most one proposal per turn. If nothing is worth saving, omit the line entirely. The app parses this line out before showing the response to the user.`

const GROUNDING = `KNOWLEDGE BASE GROUNDING:
You may receive local reference snippets (restaurants, venues, opening hours, neighbourhoods) for the user's city from the curated Halo knowledge base. When provided and relevant, prefer them over your general knowledge. Never include raw reference identifiers or retrieval metadata in your user-facing reply.`
