import { pgTable, uuid, text, timestamp, integer, jsonb, index, pgEnum } from 'drizzle-orm/pg-core'
import { AI_MESSAGE_ROLES, FEEDBACK_RATINGS } from '@halo/shared'
import { aiConversations } from './ai-conversations.js'

// #13: pgEnum declarations sourced from @halo/shared constants
export const aiMessageRoleEnum = pgEnum('ai_message_role', [...AI_MESSAGE_ROLES])
export const feedbackRatingEnum = pgEnum('feedback_rating', [...FEEDBACK_RATINGS])

// Note: Monthly range partitioning on created_at will be added via raw SQL in migration.
// Drizzle schema defines the logical table; partitioning is a physical concern.
export const aiMessages = pgTable(
  'ai_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => aiConversations.id, { onDelete: 'cascade' }),
    role: aiMessageRoleEnum('role').notNull(),
    content: text('content').notNull(), // encrypted at application level
    tokenCount: integer('token_count'),
    feedbackRating: feedbackRatingEnum('feedback_rating'),
    safetyFlags: jsonb('safety_flags'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('ai_messages_conversation_created_idx').on(table.conversationId, table.createdAt),
  ],
)
