import { sql } from 'drizzle-orm'
import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core'
import { users } from './users.js'
import { vaultTopicEnum } from './enums.js'

// `content` stores the AES-256-GCM envelope ciphertext of the JSON-serialised
// entry payload (per-type schema validated at the repo layer). Column is
// `text` (not jsonb) because the value is always opaque ciphertext to Postgres
// — never queried, never indexed, never inspected by SQL.

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
