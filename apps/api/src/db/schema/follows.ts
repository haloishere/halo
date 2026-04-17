import { pgTable, uuid, timestamp, unique, index } from 'drizzle-orm/pg-core'
import { users } from './users.js'

export const follows = pgTable(
  'follows',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    followerId: uuid('follower_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    followingId: uuid('following_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('follows_follower_following_uniq').on(table.followerId, table.followingId),
    index('follows_follower_idx').on(table.followerId),
    index('follows_following_idx').on(table.followingId),
  ],
)
