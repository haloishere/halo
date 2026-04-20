import { pgTable, uuid, text, timestamp, pgEnum, smallint } from 'drizzle-orm/pg-core'
import { USER_TIERS, USER_ROLES, CAREGIVER_RELATIONSHIPS, DIAGNOSIS_STAGES } from '@halo/shared'

// #13: pgEnum declarations sourced from @halo/shared constants (single source of truth)
export const userTierEnum = pgEnum('user_tier', [...USER_TIERS])
export const userRoleEnum = pgEnum('user_role', [...USER_ROLES])
export const caregiverRelationshipEnum = pgEnum('caregiver_relationship', [
  ...CAREGIVER_RELATIONSHIPS,
])
export const diagnosisStageEnum = pgEnum('diagnosis_stage', [...DIAGNOSIS_STAGES])

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  firebaseUid: text('firebase_uid').notNull().unique(),
  email: text('email').notNull().unique(), // #15: encryption deferred — needs architectural decision on searchability trade-off
  displayName: text('display_name').notNull(),
  tier: userTierEnum('tier').notNull().default('free'),
  role: userRoleEnum('role').notNull().default('user'),
  caregiverRelationship: caregiverRelationshipEnum('caregiver_relationship'),
  diagnosisStage: diagnosisStageEnum('diagnosis_stage'),
  challenges: text('challenges').array(),
  city: text('city'),
  age: smallint('age'),
  onboardingCompleted: timestamp('onboarding_completed', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})
