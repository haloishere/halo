import { pgTable, uuid, text, integer, timestamp, index } from 'drizzle-orm/pg-core'
import { communityPosts, postStatusEnum } from './community-posts.js'
import { users } from './users.js'

export const communityReplies = pgTable(
  'community_replies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    postId: uuid('post_id')
      .notNull()
      .references(() => communityPosts.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    likeCount: integer('like_count').notNull().default(0),
    status: postStatusEnum('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index('community_replies_post_created_idx').on(table.postId, table.createdAt)],
)
