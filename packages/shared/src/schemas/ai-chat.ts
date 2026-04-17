import { z } from 'zod'
import { AI_MESSAGE_ROLES, FEEDBACK_RATINGS } from '../constants/enums.js'

export const createConversationSchema = z.object({
  title: z.string().min(1).max(200).optional(),
})

export const sendMessageSchema = z.object({
  content: z.string().trim().min(1).max(5000),
})

export const submitFeedbackSchema = z.object({
  rating: z.enum(FEEDBACK_RATINGS),
})

export const aiMessageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  role: z.enum(AI_MESSAGE_ROLES),
  content: z.string(),
  tokenCount: z.number().int().nonnegative().nullable(),
  feedbackRating: z.enum(FEEDBACK_RATINGS).nullable(),
  createdAt: z.string().datetime(),
})

export const aiConversationSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  title: z.string().nullable(),
  summary: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

/**
 * Composite keyset cursor for MRU-ordered conversation pagination.
 *
 * Format: `{isoDatetime}|{uuid}` — the last returned row's `updatedAt` and
 * `id`. The `id` tie-break is load-bearing: a single-column `updatedAt`
 * cursor would silently drop rows that share the same millisecond and
 * straddle a page boundary (saveMessage writes `new Date()` which is
 * ms-precision, so collisions happen on any burst activity).
 *
 * Historically this was a plain ISO datetime tracking `createdAt`; as of
 * the 2h cold-open resume rule it tracks `updatedAt` so newly active chats
 * bubble to the top, and carries the id for stable pagination.
 */
const COMPOSITE_CURSOR_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z\|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

export const listConversationsQuerySchema = z.object({
  cursor: z
    .string()
    .regex(COMPOSITE_CURSOR_REGEX, 'cursor must be in the format `isoDatetime|uuid`')
    .optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export const conversationParamsSchema = z.object({
  id: z.string().uuid(),
})

export const feedbackParamsSchema = z.object({
  id: z.string().uuid(),
  messageId: z.string().uuid(),
})

export type CreateConversation = z.infer<typeof createConversationSchema>
export type SendMessage = z.infer<typeof sendMessageSchema>
export type SubmitFeedback = z.infer<typeof submitFeedbackSchema>
export type AiMessage = z.infer<typeof aiMessageSchema>
export type AiConversation = z.infer<typeof aiConversationSchema>
export type ListConversationsQuery = z.infer<typeof listConversationsQuerySchema>
