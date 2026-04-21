import { sql } from 'drizzle-orm'
import { pgEnum, pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core'
import { VAULT_TOPICS } from '@halo/shared'
import { users } from './users.js'

// Shared pg enum — authoritative gate for `vault_entries.topic` and
// `ai_conversations.topic`. Mirrors `VAULT_TOPICS` in @halo/shared.
export const vaultTopicEnum = pgEnum('vault_topic', VAULT_TOPICS)

export const vaultEntries = pgTable(
  'vault_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    topic: vaultTopicEnum('topic').notNull(),
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('vault_entries_user_id_idx').on(table.userId),
    index('vault_entries_user_type_idx').on(table.userId, table.type),
    // Partial — soft-deleted rows are never read in scenario queries, so they
    // don't belong in the index. The `.where()` on the builder keeps Drizzle
    // in sync with the migration SQL so `drizzle-kit generate` won't emit a
    // spurious migration to drop and recreate as a plain index.
    index('vault_entries_user_topic_idx')
      .on(table.userId, table.topic)
      .where(sql`${table.deletedAt} IS NULL`),
  ],
)
