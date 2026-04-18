import { eq } from 'drizzle-orm'
import type { DrizzleDb } from '../../db/types.js'
import { users } from '../../db/schema/index.js'
import type { Onboarding } from '@halo/shared'
import { sanitizeDisplayName } from '../../lib/sanitize.js'

export type UserRecord = typeof users.$inferSelect

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
  const trimmedCity = data.city?.trim()

  const [updated] = await db
    .update(users)
    .set({
      ...(sanitizedName ? { displayName: sanitizedName } : {}),
      ...(trimmedCity ? { city: trimmedCity } : {}),
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
