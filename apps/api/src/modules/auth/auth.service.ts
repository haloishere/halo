import { eq } from 'drizzle-orm'
import pino from 'pino'
import type { DrizzleDb } from '../../db/types.js'
import { users } from '../../db/schema/index.js'
import { firebaseAuth } from '../../lib/firebase-admin.js'
import { writeAuditLog } from '../../lib/audit.js'
import { sanitizeDisplayName } from '../../lib/sanitize.js'

const logger = pino({ name: 'auth-service' })

export type UserRecord = typeof users.$inferSelect

export async function registerUser(
  db: DrizzleDb,
  firebaseUid: string,
  email: string,
  displayName: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<UserRecord> {
  const user = await upsertDbUser(db, firebaseUid, email, displayName)

  // Set custom claims so the mobile client picks them up on next token refresh.
  // Swallow errors — claims will sync on next /v1/auth/sync call.
  try {
    await firebaseAuth.setCustomUserClaims(firebaseUid, {
      role: user.role,
      tier: user.tier,
    })
  } catch (err) {
    logger.warn({ firebaseUid, err }, 'Failed to set custom claims during registration')
  }

  await writeAuditLog(db, {
    userId: user.id,
    action: 'user.register',
    resource: 'user',
    resourceId: user.id,
    ipAddress,
    userAgent,
  })

  return user
}

export async function syncUser(
  db: DrizzleDb,
  firebaseUid: string,
  email: string,
  ipAddress?: string,
  userAgent?: string,
  displayName?: string,
): Promise<UserRecord> {
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.firebaseUid, firebaseUid))
    .limit(1)

  const user = existing ?? (await upsertDbUser(db, firebaseUid, email, displayName))

  // Sync custom claims from DB (DB is authoritative for role/tier)
  try {
    await firebaseAuth.setCustomUserClaims(firebaseUid, {
      role: user.role,
      tier: user.tier,
    })
  } catch (err) {
    logger.warn({ firebaseUid, err }, 'Failed to sync custom claims')
  }

  await writeAuditLog(db, {
    userId: user.id,
    action: existing ? 'user.sync' : 'user.register',
    resource: 'user',
    resourceId: user.id,
    ipAddress,
    userAgent,
  })

  return user
}

/**
 * Shared upsert logic for creating or updating a DB user.
 * Single source of truth — used by syncUser, registerUser, and verifyOtp (OTP flow).
 *
 * Email conflict (different firebaseUid for same email) is rejected with 409.
 * Firebase "one account per email" should be enabled as the primary defense;
 * this 409 is a server-side safety net.
 */
export async function upsertDbUser(
  db: DrizzleDb,
  firebaseUid: string,
  email: string,
  displayName?: string,
): Promise<UserRecord> {
  const raw = displayName ?? email.split('@')[0] ?? email
  const name = sanitizeDisplayName(raw) || 'User'

  // Only overwrite displayName on conflict if one was explicitly provided.
  // Without this guard, OTP sign-in (which passes no displayName) would
  // overwrite a Google-sourced name with the email prefix.
  const conflictSet: Record<string, unknown> = { email, updatedAt: new Date() }
  if (displayName !== undefined) {
    conflictSet.displayName = name
  }

  const rows = await db
    .insert(users)
    .values({ firebaseUid, email, displayName: name })
    .onConflictDoUpdate({
      target: users.firebaseUid,
      set: conflictSet,
    })
    .returning()
    .catch((err: unknown) => {
      const isEmailConflict =
        err instanceof Error &&
        'code' in err &&
        (err as { code: string }).code === '23505' &&
        'constraint_name' in err &&
        (err as { constraint_name: string }).constraint_name === 'users_email_unique'
      if (!isEmailConflict) throw err

      // Email belongs to a different Firebase account — reject to prevent account takeover
      logger.warn(
        { firebaseUid, emailHash: email.replace(/(.{2}).*(@.*)/, '$1***$2') },
        'Email conflict: email already belongs to another Firebase account',
      )
      throw Object.assign(new Error('This email is already associated with another account'), {
        statusCode: 409,
      })
    })

  const user = rows[0]
  if (!user) {
    throw new Error('Failed to create or retrieve user after upsert')
  }

  return user
}
