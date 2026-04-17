import { pgTable, uuid, text, timestamp, index, unique, pgEnum } from 'drizzle-orm/pg-core'
import { REPORT_REASONS, REPORT_STATUSES } from '@halo/shared'
import { users } from './users.js'
import { communityPosts } from './community-posts.js'
import { communityReplies } from './community-replies.js'

export const reportReasonEnum = pgEnum('report_reason', [...REPORT_REASONS])
export const reportStatusEnum = pgEnum('report_status', [...REPORT_STATUSES])

export const reports = pgTable(
  'reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reporterId: uuid('reporter_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    postId: uuid('post_id').references(() => communityPosts.id, { onDelete: 'set null' }),
    replyId: uuid('reply_id').references(() => communityReplies.id, { onDelete: 'set null' }),
    reason: reportReasonEnum('reason').notNull(),
    details: text('details'),
    status: reportStatusEnum('status').notNull().default('pending'),
    reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('reports_status_idx').on(table.status),
    unique('reports_reporter_post_uniq').on(table.reporterId, table.postId),
    unique('reports_reporter_reply_uniq').on(table.reporterId, table.replyId),
  ],
)
