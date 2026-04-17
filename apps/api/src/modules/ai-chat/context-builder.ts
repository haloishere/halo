import type { AiContent } from '../../lib/vertex-ai.js'

export interface DbMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: Date
}

const MAX_CONTEXT_MESSAGES = 20

/**
 * Build the conversation context for a Gemini API call.
 * Takes the last N messages and maps DB roles to Gemini format.
 * DB `assistant` → Gemini `model`, DB `user` → Gemini `user`.
 * System messages are excluded (handled via systemInstruction).
 */
export function buildConversationContext(messages: DbMessage[]): AiContent[] {
  const contextMessages =
    messages.length > MAX_CONTEXT_MESSAGES ? messages.slice(-MAX_CONTEXT_MESSAGES) : messages

  return contextMessages
    .filter((m): m is DbMessage & { role: 'user' | 'assistant' } => m.role !== 'system')
    .map((m) => ({
      role: mapRole(m.role),
      parts: [{ text: m.content }],
    }))
}

function mapRole(dbRole: 'user' | 'assistant'): 'user' | 'model' {
  return dbRole === 'assistant' ? 'model' : 'user'
}
