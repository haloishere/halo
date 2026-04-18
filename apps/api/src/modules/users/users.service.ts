import { eq, and } from 'drizzle-orm'
import type { DrizzleDb } from '../../db/types.js'
import { users, careRecipients } from '../../db/schema/index.js'
import { encryption } from '../../lib/encryption.js'
import type { Onboarding, CreateCareRecipient, UpdateCareRecipient } from '@halo/shared'
import { sanitizeDisplayName } from '../../lib/sanitize.js'

export type UserRecord = typeof users.$inferSelect
export type CareRecipientRecord = typeof careRecipients.$inferSelect

// ─── User profile ───────────────────────────────────────────────────────────

export async function getProfile(db: DrizzleDb, userId: string): Promise<UserRecord | null> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  return user ?? null
}

export async function updateOnboarding(
  db: DrizzleDb,
  userId: string,
  data: Onboarding,
): Promise<UserRecord> {
  const sanitizedName =
    data.displayName !== undefined ? sanitizeDisplayName(data.displayName) : undefined

  // Stage 0: `city` is accepted via the new Zod contract but not yet persisted —
  // the `city` column lands in Stage 5 along with the mobile wiring.
  const [updated] = await db
    .update(users)
    .set({
      ...(sanitizedName ? { displayName: sanitizedName } : {}),
      onboardingCompleted: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning()

  if (!updated) {
    throw Object.assign(new Error('User not found'), { statusCode: 404 })
  }
  return updated
}

// ─── Care recipients ────────────────────────────────────────────────────────

export async function createCareRecipient(
  db: DrizzleDb,
  userId: string,
  data: CreateCareRecipient,
): Promise<CareRecipientRecord> {
  const encryptedName = await encryption.encryptField(data.name, userId)
  const encryptedDiagnosisDetails = data.diagnosisDetails
    ? await encryption.encryptField(data.diagnosisDetails, userId)
    : null
  const encryptedDateOfBirth = data.dateOfBirth
    ? await encryption.encryptField(data.dateOfBirth, userId)
    : null

  const rows = await db
    .insert(careRecipients)
    .values({
      userId,
      name: encryptedName,
      relationship: data.relationship,
      diagnosisStage: data.diagnosisStage,
      diagnosisDetails: encryptedDiagnosisDetails,
      dateOfBirth: encryptedDateOfBirth,
    })
    .returning()

  const record = rows[0]
  if (!record) {
    throw new Error('Failed to create care recipient')
  }
  return toCareRecipientResponse(record, userId)
}

export async function listCareRecipients(
  db: DrizzleDb,
  userId: string,
): Promise<CareRecipientRecord[]> {
  const records = await db.select().from(careRecipients).where(eq(careRecipients.userId, userId))

  return Promise.all(
    records.map(async (r) => {
      try {
        return await toCareRecipientResponse(r, userId)
      } catch {
        // H6: One corrupted record must not block the entire list
        return {
          ...r,
          name: '[Decryption failed]',
          diagnosisDetails: null,
          dateOfBirth: null,
        }
      }
    }),
  )
}

export async function updateCareRecipient(
  db: DrizzleDb,
  userId: string,
  id: string,
  data: UpdateCareRecipient,
): Promise<CareRecipientRecord> {
  const existing = await findOwnedRecipient(db, userId, id)

  const updates: Partial<CareRecipientRecord> = {}
  if (data.name !== undefined) updates.name = await encryption.encryptField(data.name, userId)
  if (data.diagnosisDetails !== undefined) {
    updates.diagnosisDetails = await encryption.encryptField(data.diagnosisDetails, userId)
  }
  if (data.dateOfBirth !== undefined) {
    updates.dateOfBirth = await encryption.encryptField(data.dateOfBirth, userId)
  }
  if (data.relationship !== undefined) updates.relationship = data.relationship
  if (data.diagnosisStage !== undefined) updates.diagnosisStage = data.diagnosisStage

  const [updated] = await db
    .update(careRecipients)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(eq(careRecipients.id, id), eq(careRecipients.userId, userId)))
    .returning()

  return toCareRecipientResponse(updated ?? existing, userId)
}

export async function deleteCareRecipient(
  db: DrizzleDb,
  userId: string,
  id: string,
): Promise<void> {
  await findOwnedRecipient(db, userId, id)
  await db
    .delete(careRecipients)
    .where(and(eq(careRecipients.id, id), eq(careRecipients.userId, userId)))
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function findOwnedRecipient(
  db: DrizzleDb,
  userId: string,
  id: string,
): Promise<CareRecipientRecord> {
  const [record] = await db
    .select()
    .from(careRecipients)
    .where(and(eq(careRecipients.id, id), eq(careRecipients.userId, userId)))
    .limit(1)

  if (!record) {
    throw Object.assign(new Error('Care recipient not found'), { statusCode: 404 })
  }
  return record
}

async function toCareRecipientResponse(
  record: CareRecipientRecord,
  userId: string,
): Promise<CareRecipientRecord> {
  const decryptedName = await encryption.decryptField(record.name, userId)
  const decryptedDiagnosisDetails = record.diagnosisDetails
    ? await encryption.decryptField(record.diagnosisDetails, userId)
    : null
  const decryptedDateOfBirth = record.dateOfBirth
    ? await encryption.decryptField(record.dateOfBirth, userId)
    : null

  return {
    ...record,
    name: decryptedName,
    diagnosisDetails: decryptedDiagnosisDetails,
    dateOfBirth: decryptedDateOfBirth,
  }
}
