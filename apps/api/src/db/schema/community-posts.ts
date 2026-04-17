import { pgTable, uuid, text, integer, timestamp, index, pgEnum } from 'drizzle-orm/pg-core'
import { POST_STATUSES } from '@halo/shared'
import { circles } from './circles.js'
import { users } from './users.js'

export const postStatusEnum = pgEnum('post_status', [...POST_STATUSES])

export const communityPosts = pgTable(
  'community_posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    circleId: uuid('circle_id')
      .notNull()
      .references(() => circles.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    body: text('body').notNull(),
    imageUrls: text('image_urls').array().notNull().default([]),
    likeCount: integer('like_count').notNull().default(0),
    replyCount: integer('reply_count').notNull().default(0),
    featuredAt: timestamp('featured_at', { withTimezone: true }),
    status: postStatusEnum('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('community_posts_circle_idx').on(table.circleId),
    index('community_posts_author_idx').on(table.authorId),
    index('community_posts_created_idx').on(table.createdAt),
    index('community_posts_featured_idx').on(table.featuredAt),
    index('community_posts_status_idx').on(table.status),
  ],
)
