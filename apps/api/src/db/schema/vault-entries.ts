import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core'
import { users } from './users.js'

// vault_entries.content stores the AES-256-GCM envelope ciphertext of the
// JSON-serialised entry payload (per-type schema validated at the repo layer).
// Per the migration plan the column is `text` (not jsonb) because the value is
// always opaque ciphertext to Postgres.
export const vaultEntries = pgTable(
  'vault_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
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
  ],
)
