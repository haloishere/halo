import { pgTable, uuid, timestamp, unique, index } from 'drizzle-orm/pg-core'
import { users } from './users.js'
import { contentItems } from './content-items.js'

export const bookmarks = pgTable(
  'bookmarks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    contentItemId: uuid('content_item_id')
      .notNull()
      .references(() => contentItems.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('bookmarks_user_item_uniq').on(table.userId, table.contentItemId),
    index('bookmarks_user_idx').on(table.userId),
  ],
)
