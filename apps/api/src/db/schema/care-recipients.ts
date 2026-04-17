import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core'
import { users, caregiverRelationshipEnum, diagnosisStageEnum } from './users.js'

export const careRecipients = pgTable(
  'care_recipients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // name and diagnosisDetails are encrypted at the application level via Cloud KMS
    name: text('name').notNull(), // encrypted ciphertext
    relationship: caregiverRelationshipEnum('relationship').notNull(),
    diagnosisStage: diagnosisStageEnum('diagnosis_stage').notNull(),
    diagnosisDetails: text('diagnosis_details'), // encrypted ciphertext
    dateOfBirth: text('date_of_birth'), // encrypted ciphertext (ISO date string) — PII/PHI
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index('care_recipients_user_id_idx').on(table.userId)],
)
