import { pgTable, uuid, timestamp, unique, index } from 'drizzle-orm/pg-core'
import { users } from './users.js'
import { communityReplies } from './community-replies.js'

export const replyLikes = pgTable(
  'reply_likes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    replyId: uuid('reply_id')
      .notNull()
      .references(() => communityReplies.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('reply_likes_user_reply_uniq').on(table.userId, table.replyId),
    index('reply_likes_user_idx').on(table.userId),
  ],
)
