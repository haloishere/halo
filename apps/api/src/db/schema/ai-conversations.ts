import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core'
import { users } from './users.js'
import { vaultTopicEnum } from './vault-entries.js'

export const aiConversations = pgTable(
  'ai_conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title'),
    summary: text('summary'),
    topic: vaultTopicEnum('topic').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('ai_conversations_user_id_idx').on(table.userId),
    index('ai_conversations_user_created_idx').on(table.userId, table.createdAt),
    // MRU ordering index — powers `listConversations` which sorts by
    // `updated_at DESC` and uses `updated_at` for cursor pagination.
    index('ai_conversations_user_updated_idx').on(table.userId, table.updatedAt),
    // Phase-3 will filter conversations by `(user_id, topic)` to render the
    // Portrait tab's per-scenario history. Shipped now to avoid retrofit.
    index('ai_conversations_user_topic_idx').on(table.userId, table.topic),
  ],
)
