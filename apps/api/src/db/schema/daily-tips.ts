import { pgTable, uuid, text, date, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core'

export const dailyTips = pgTable(
  'daily_tips',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tipDate: date('tip_date').notNull(),
    tip: text('tip').notNull(),
    category: text('category').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('daily_tips_tip_date_idx').on(table.tipDate),
    uniqueIndex('daily_tips_date_tip_uniq').on(table.tipDate, table.tip),
  ],
)
