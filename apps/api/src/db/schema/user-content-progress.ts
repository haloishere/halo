import { pgTable, uuid, integer, timestamp, unique, index } from 'drizzle-orm/pg-core'
import { users } from './users.js'
import { contentItems } from './content-items.js'

export const userContentProgress = pgTable(
  'user_content_progress',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    contentItemId: uuid('content_item_id')
      .notNull()
      .references(() => contentItems.id, { onDelete: 'cascade' }),
    progressPercent: integer('progress_percent').notNull().default(0),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique('user_content_progress_user_item_uniq').on(table.userId, table.contentItemId),
    index('user_content_progress_user_idx').on(table.userId),
  ],
)
