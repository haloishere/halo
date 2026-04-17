import { pgTable, uuid, timestamp, unique, index } from 'drizzle-orm/pg-core'
import { users } from './users.js'
import { communityPosts } from './community-posts.js'

export const postLikes = pgTable(
  'post_likes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    postId: uuid('post_id')
      .notNull()
      .references(() => communityPosts.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('post_likes_user_post_uniq').on(table.userId, table.postId),
    index('post_likes_user_idx').on(table.userId),
  ],
)
