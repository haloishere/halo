import { z } from 'zod'
import { VAULT_TOPICS } from '../constants/vault-topics.js'

// V1 only ships `preference`. Adding a new type later is additive: extend the
// VAULT_ENTRY_TYPES tuple, define a `<type>ContentSchema`, and add it to the
// vaultEntryInputSchema discriminated union.
export const VAULT_ENTRY_TYPES = ['preference'] as const
export type VaultEntryType = (typeof VAULT_ENTRY_TYPES)[number]

export const PREFERENCE_CATEGORIES = ['food', 'activity', 'place', 'lifestyle'] as const
export const PREFERENCE_SENTIMENTS = ['likes', 'dislikes', 'neutral'] as const

export const SUBJECT_MAX_LENGTH = 200
export const NOTES_MAX_LENGTH = 500

export const preferenceContentSchema = z.object({
  category: z.enum(PREFERENCE_CATEGORIES),
  subject: z.string().min(1).max(SUBJECT_MAX_LENGTH),
  sentiment: z.enum(PREFERENCE_SENTIMENTS),
  confidence: z.number().min(0).max(1),
  notes: z.string().max(NOTES_MAX_LENGTH).optional(),
})

// `topic` is a plaintext row-level column, orthogonal to `type`. It routes the
// scenario picker (food / fashion / lifestyle) and drives retrieval without
// decrypting `content`. DB authoritative — a pg enum (migration 0012) rejects
// unknown values before the row reaches Drizzle.
export const vaultEntryInputSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('preference'),
    topic: z.enum(VAULT_TOPICS),
    content: preferenceContentSchema,
  }),
])

const recordMetadataShape = {
  id: z.string().uuid(),
  userId: z.string().uuid(),
  topic: z.enum(VAULT_TOPICS),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
}

export const vaultEntryRecordSchema = z.discriminatedUnion('type', [
  z.object({
    ...recordMetadataShape,
    type: z.literal('preference'),
    content: preferenceContentSchema,
  }),
])

export type PreferenceContent = z.infer<typeof preferenceContentSchema>
export type VaultEntryInput = z.infer<typeof vaultEntryInputSchema>
export type VaultEntryRecord = z.infer<typeof vaultEntryRecordSchema>
