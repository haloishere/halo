import { pgTable, uuid, text, timestamp, index, pgEnum } from 'drizzle-orm/pg-core'
import { CONTENT_CATEGORIES } from '@halo/shared'
import { users, diagnosisStageEnum } from './users.js'

// #13: pgEnum declarations sourced from @halo/shared constants
export const contentCategoryEnum = pgEnum('content_category', [...CONTENT_CATEGORIES])

export const contentItems = pgTable(
  'content_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull(),
    slug: text('slug').notNull().unique(),
    body: text('body').notNull(), // Markdown
    category: contentCategoryEnum('category').notNull(),
    diagnosisStages: diagnosisStageEnum('diagnosis_stages').array().notNull(),
    videoUrl: text('video_url'),
    thumbnailUrl: text('thumbnail_url'),
    authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index('content_items_category_idx').on(table.category)],
)
