import { pgTable, uuid, text, timestamp, integer, index } from 'drizzle-orm/pg-core'

export const otpCodes = pgTable(
  'otp_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    codeHash: text('code_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    attempts: integer('attempts').notNull().default(0),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('otp_codes_email_expires_at_idx').on(table.email, table.expiresAt),
    index('otp_codes_created_at_idx').on(table.createdAt),
  ],
)
