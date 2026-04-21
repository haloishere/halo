import { eq, and, desc, or, lt, asc, isNull } from 'drizzle-orm'
import type { FastifyBaseLogger } from 'fastify'
import type { DrizzleDb } from '../../db/types.js'
import { aiConversations, aiMessages } from '../../db/schema/index.js'
import { encryption } from '../../lib/encryption.js'
import { parseCursor } from '../../lib/cursor-utils.js'
import type { AiClient } from '../../lib/vertex-ai.js'
import type { CreateConversation, SubmitFeedback, FeedbackRating } from '@halo/shared'

export type ConversationRecord = typeof aiConversations.$inferSelect
export type MessageRecord = typeof aiMessages.$inferSelect

// ─── Conversations ──────────────────────────────────────────────────────────

export async function createConversation(
  db: DrizzleDb,
  userId: string,
  data: CreateConversation,
  logger?: FastifyBaseLogger,
): Promise<ConversationRecord> {
  const rows = await db
    .insert(aiConversations)
    .values({ userId, title: data.title ?? null, topic: data.topic })
    .returning()

  const record = rows[0]
  if (!record) {
    throw new Error('Failed to create conversation')
  }

  logger?.info({ conversationId: record.id }, 'Conversation created')
  return record
}

export async function listConversations(
  db: DrizzleDb,
  userId: string,
  cursor?: string,
  limit: number = 20,
): Promise<{ conversations: ConversationRecord[]; nextCursor: string | null }> {
  const conditions = [eq(aiConversations.userId, userId)]

  // Composite `(updatedAt, id)` keyset cursor. A single-column `updatedAt` bound
  // would silently drop rows that share the same millisecond and straddle a
  // page boundary (saveMessage writes `new Date()` which is ms-precision, so
  // collisions happen on any burst write). The `id` tie-break guarantees every
  // row appears on exactly one page. Format: `isoDate|uuid` — see lib/cursor-utils.
  if (cursor) {
    const parsed = parseCursor(cursor)
    if (parsed) {
      // drizzle types `or()` as `SQL | undefined` because it returns undefined
      // on zero args. Both args below are concrete, so the result is always
      // defined — the `!` assertion narrows the type without a runtime check.
      conditions.push(
        or(
          lt(aiConversations.updatedAt, parsed.date),
          and(eq(aiConversations.updatedAt, parsed.date), lt(aiConversations.id, parsed.id)),
        )!,
      )
    }
    // Silently ignore malformed cursors — the list will restart from the top,
    // which is the same behaviour as `cursor === undefined`. Callers may tighten
    // this at the route layer if they want a 400 on invalid input.
  }

  const conversations = await db
    .select()
    .from(aiConversations)
    .where(and(...conditions))
    // MRU ordering — newest activity first. Tie-break on `id DESC` keeps
    // pagination stable across same-millisecond `updatedAt` collisions.
    // Backed by the `(user_id, updated_at)` index.
    .orderBy(desc(aiConversations.updatedAt), desc(aiConversations.id))
    .limit(limit + 1) // Fetch one extra to determine if there's a next page

  const hasMore = conversations.length > limit
  const results = hasMore ? conversations.slice(0, limit) : conversations

  const nextCursor =
    hasMore && results.length > 0
      ? `${results[results.length - 1]!.updatedAt.toISOString()}|${results[results.length - 1]!.id}`
      : null

  return { conversations: results, nextCursor }
}

export async function getConversation(
  db: DrizzleDb,
  userId: string,
  conversationId: string,
): Promise<ConversationRecord> {
  const [record] = await db
    .select()
    .from(aiConversations)
    .where(and(eq(aiConversations.id, conversationId), eq(aiConversations.userId, userId)))
    .limit(1)

  if (!record) {
    throw Object.assign(new Error('Conversation not found'), { statusCode: 404 })
  }
  return record
}

export async function getConversationMessages(
  db: DrizzleDb,
  userId: string,
  conversationId: string,
  logger?: FastifyBaseLogger,
): Promise<MessageRecord[]> {
  // Verify ownership
  await getConversation(db, userId, conversationId)

  const messages = await db
    .select()
    .from(aiMessages)
    .where(eq(aiMessages.conversationId, conversationId))
    .orderBy(asc(aiMessages.createdAt))

  // Decrypt message content
  return Promise.all(
    messages.map(async (m) => {
      try {
        const decryptedContent = await encryption.decryptField(m.content, userId)
        return { ...m, content: decryptedContent }
      } catch (err) {
        logger?.error({ err, messageId: m.id, conversationId }, 'Message decryption failed')
        return { ...m, content: '[Decryption failed]' }
      }
    }),
  )
}

export async function deleteConversation(
  db: DrizzleDb,
  userId: string,
  conversationId: string,
  logger?: FastifyBaseLogger,
): Promise<void> {
  // Verify ownership before deleting
  await getConversation(db, userId, conversationId)

  await db
    .delete(aiConversations)
    .where(and(eq(aiConversations.id, conversationId), eq(aiConversations.userId, userId)))

  logger?.info({ conversationId }, 'Conversation deleted')
}

/** Max characters of the first message to send to the title generator */
const TITLE_INPUT_CAP = 500

export const TITLE_PROMPT =
  'Generate a short conversation title (3-5 words, no quotes) that summarizes the user message. ' +
  'Respond with only the title, nothing else. ' +
  'Do not include personal names, specific medications, or medical diagnoses in the title.'

/**
 * Fire-and-forget title generation for untitled conversations.
 * The entire body is wrapped in try/catch — callers should still add `.catch()` as defense-in-depth.
 * Uses atomic UPDATE ... WHERE title IS NULL to avoid TOCTOU races and eliminate a SELECT round-trip.
 */
export async function autoTitleConversation(
  db: DrizzleDb,
  aiClient: AiClient,
  userId: string,
  conversationId: string,
  firstMessage: string,
  logger?: FastifyBaseLogger,
): Promise<void> {
  try {
    // Truncate input — no need to send full message for a 3-5 word title
    const truncated = firstMessage.slice(0, TITLE_INPUT_CAP)

    const raw = await aiClient.generateContent(TITLE_PROMPT, [
      { role: 'user', parts: [{ text: truncated }] },
    ])
    const title = raw.trim().slice(0, 200) || 'New Chat'

    // Atomic: only sets title if still NULL — prevents race when two messages arrive concurrently
    await db
      .update(aiConversations)
      .set({ title })
      .where(
        and(
          eq(aiConversations.id, conversationId),
          eq(aiConversations.userId, userId),
          isNull(aiConversations.title),
        ),
      )

    logger?.info({ conversationId }, 'Auto-titled conversation')
  } catch (err) {
    logger?.error({ err, conversationId }, 'Auto-title generation failed')
  }
}

// ─── Messages ───────────────────────────────────────────────────────────────

export async function saveMessage(
  db: DrizzleDb,
  userId: string,
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  tokenCount?: number | null,
  safetyFlags?: Record<string, unknown> | null,
): Promise<MessageRecord> {
  const encryptedContent = await encryption.encryptField(content, userId)

  // INSERT the message and bump the parent's updatedAt atomically. Wrapping
  // in a transaction prevents a crash-in-the-gap from persisting the message
  // while leaving `updatedAt` stale — which would silently break the 2h
  // cold-open resume rule by leaving the conversation buried in MRU order.
  return db.transaction(async (tx) => {
    const rows = await tx
      .insert(aiMessages)
      .values({
        conversationId,
        role,
        content: encryptedContent,
        tokenCount: tokenCount ?? null,
        safetyFlags: safetyFlags ?? null,
      })
      .returning()

    const record = rows[0]
    if (!record) {
      throw new Error('Failed to save message')
    }

    // Touch the parent conversation's `updatedAt` so MRU listing
    // (`listConversations`) surfaces freshly-active chats at the top.
    //
    // Why an explicit `.set({ updatedAt: new Date() })` rather than relying
    // on `.$onUpdate()`: drizzle's `.$onUpdate()` only generates a value when
    // the column is ABSENT from the SET list. An UPDATE with no other columns
    // to set would produce an empty SET clause and do nothing. The explicit
    // set is load-bearing — do not remove it.
    //
    // Why `userId` is in the WHERE clause AND why we assert `.returning()`
    // is non-empty: defense in depth against IDOR. If a caller passes a
    // (userId, conversationId) pair where the conversation does not belong
    // to the user, the WHERE clause matches zero rows and `tx.update()`
    // silently no-ops — by itself this would leave the INSERT above
    // committed, orphaning a message row inside another user's conversation.
    // Checking `length === 0` and throwing forces the whole transaction
    // (INSERT included) to roll back. Zero extra round-trips compared to a
    // pre-check. Matches the ownership-enforcement pattern of
    // `deleteConversation` above without the extra SELECT.
    //
    // `.$onUpdate()` still exists on the column for other UPDATEs in the
    // codebase (e.g. `autoTitleConversation` only sets `title` — the hook
    // fires there to bump `updatedAt` a second time). Harmless for MRU
    // ordering, but the "activity timestamp" of the very first message
    // reflects the title-return time, not the send time. If the mobile
    // client ever checks the 2h cold-open threshold against `updatedAt`
    // (rather than just using it for ordering), expect up to a few seconds
    // of drift on the first message due to the fire-and-forget Gemini call.
    const updated = await tx
      .update(aiConversations)
      .set({ updatedAt: new Date() })
      .where(and(eq(aiConversations.id, conversationId), eq(aiConversations.userId, userId)))
      .returning({ id: aiConversations.id })

    if (updated.length === 0) {
      throw Object.assign(new Error('Conversation not found'), { statusCode: 404 })
    }

    return record
  })
}

export async function submitFeedback(
  db: DrizzleDb,
  userId: string,
  conversationId: string,
  messageId: string,
  data: SubmitFeedback,
  logger?: FastifyBaseLogger,
): Promise<MessageRecord> {
  // Verify conversation ownership
  await getConversation(db, userId, conversationId)

  const [message] = await db
    .select()
    .from(aiMessages)
    .where(and(eq(aiMessages.id, messageId), eq(aiMessages.conversationId, conversationId)))
    .limit(1)

  if (!message) {
    throw Object.assign(new Error('Message not found'), { statusCode: 404 })
  }

  if (message.role !== 'assistant') {
    throw Object.assign(new Error('Can only rate assistant messages'), { statusCode: 400 })
  }

  const [updated] = await db
    .update(aiMessages)
    .set({ feedbackRating: data.rating as FeedbackRating })
    .where(eq(aiMessages.id, messageId))
    .returning()

  if (!updated) {
    throw new Error('Failed to update feedback')
  }

  logger?.info({ messageId, rating: data.rating }, 'Feedback submitted')
  return updated
}
