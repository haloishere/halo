/**
 * Pure decision helper for the 2h cold-open chat resume rule.
 *
 * The mobile loader screen calls this with the most-recent conversation
 * from `useConversationsQuery()` and the current `Date`. It returns
 * `true` if the loader should resume that conversation, or `false` if
 * it should create a new one.
 *
 * Kept in `lib/` rather than inlined into the loader screen so the
 * boundary logic can be unit-tested exhaustively against the spec
 * without mounting a React tree.
 *
 * Contract (locked by `chat-resume.test.ts`):
 * - No conversation available (undefined/null) → create new (returns false).
 * - Activity strictly less than 2 hours ago → resume (returns true).
 * - Activity exactly at the 2h boundary → create new (strict `<`, not `<=`).
 * - Activity more than 2 hours ago → create new.
 * - Slightly-future `updatedAt` (clock skew) → resume, on the theory that
 *   a just-touched conversation is better resumed than discarded.
 * - Invalid/unparseable `updatedAt` → create new (defensive fallback).
 */

import type { AiConversation } from '@halo/shared'

/**
 * Route-path sentinel used by the chat tab loader to request a
 * not-yet-persisted "new chat" screen. The chat detail screen
 * (`app/chat/[id].tsx`) treats this value as a local-only state — it
 * skips `useConversationQuery` (which would 404) and defers the
 * `POST /v1/ai/conversations` call until the user actually hits Send.
 *
 * This is the architectural fix for empty-conversation sprawl: the
 * backend never learns about a chat the user never typed into.
 */
export const NEW_CHAT_SENTINEL = 'new'

/** Resume threshold — activity more recent than this falls back to "resume". */
const RESUME_WINDOW_MS = 2 * 60 * 60 * 1000

/**
 * Typed as a TypeScript predicate (`conversation is AiConversation`) so the
 * caller can use a narrowing `if (shouldResume(mostRecent, now))` block and
 * access `mostRecent.id` without a non-null assertion. The boolean contract
 * is otherwise unchanged — all existing callers see the same true/false
 * values.
 */
export function shouldResume(
  conversation: AiConversation | null | undefined,
  now: Date,
): conversation is AiConversation {
  if (conversation == null) return false

  const updatedAt = new Date(conversation.updatedAt).getTime()
  // `Number.isNaN` catches unparseable ISO strings; `getTime()` returns
  // `NaN` for those. Prefer creating a fresh conversation to resuming a
  // row with an unknown activity time.
  if (Number.isNaN(updatedAt)) return false

  const age = now.getTime() - updatedAt
  return age < RESUME_WINDOW_MS
}

/**
 * Timestamp-based sibling of `shouldResume` that operates on a raw
 * millisecond value (as stored in `useLastChatStore.lastChatUpdatedAt`)
 * rather than an `AiConversation` row. Same 2h strict-`<` contract.
 *
 * Used by the Chat tab `<Redirect>` so the tab can render the decision
 * synchronously from persisted state — no `useConversationsQuery()`,
 * no network on the hot path.
 */
export function shouldResumeTimestamp(updatedAtMs: number | null, now: Date): boolean {
  if (updatedAtMs == null) return false
  const age = now.getTime() - updatedAtMs
  return age < RESUME_WINDOW_MS
}
