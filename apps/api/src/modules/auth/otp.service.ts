import crypto from 'node:crypto'
import { eq, and, isNull, gt, lt, sql, count, desc, sum } from 'drizzle-orm'
import type { DrizzleDb } from '../../db/types.js'
import { otpCodes } from '../../db/schema/index.js'
import type { users } from '../../db/schema/index.js'
import { firebaseAuth } from '../../lib/firebase-admin.js'
import { sendOtpEmail } from '../../lib/email.js'
import { writeAuditLog } from '../../lib/audit.js'
import { upsertDbUser } from './auth.service.js'

const OTP_EXPIRY_MINUTES = 10
const MAX_ATTEMPTS = 5
const MAX_ACTIVE_CODES_PER_EMAIL = 3
const MAX_SENDS_PER_EMAIL_PER_HOUR = 5
const MAX_VERIFY_FAILURES_PER_EMAIL = 10
const LOCKOUT_WINDOW_MINUTES = 30

/** Hash email for audit metadata — never store plaintext PII in audit logs. */
function hashEmail(email: string): string {
  return crypto.createHash('sha256').update(email).digest('hex').slice(0, 16)
}

/** Generate a cryptographically random 6-digit OTP code (NIST SP 800-63B). */
export function generateOtp(): string {
  return crypto.randomInt(100_000, 1_000_000).toString()
}

/** SHA-256 hash a code string for storage. */
export function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex')
}

/**
 * Create a new OTP for the given email: invalidate existing codes,
 * generate a new one, store it hashed, and send it via email.
 */
export async function createOtp(
  db: DrizzleDb,
  email: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<void> {
  const normalizedEmail = email.toLowerCase().trim()

  // Sliding-window hourly limit: counts ALL codes (expired or not) in the last hour.
  // Prevents attackers from waiting for expiry and re-sending indefinitely.
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
  const [hourlyCount] = await db
    .select({ count: count() })
    .from(otpCodes)
    .where(and(eq(otpCodes.email, normalizedEmail), gt(otpCodes.createdAt, oneHourAgo)))

  if (hourlyCount && hourlyCount.count >= MAX_SENDS_PER_EMAIL_PER_HOUR) {
    throw Object.assign(new Error('Too many codes requested'), { statusCode: 429 })
  }

  // Per-email rate limiting: prevent flooding a single inbox from multiple IPs
  const [activeCount] = await db
    .select({ count: count() })
    .from(otpCodes)
    .where(
      and(
        eq(otpCodes.email, normalizedEmail),
        isNull(otpCodes.usedAt),
        gt(otpCodes.expiresAt, new Date()),
      ),
    )

  if (activeCount && activeCount.count >= MAX_ACTIVE_CODES_PER_EMAIL) {
    throw Object.assign(new Error('Too many codes requested'), { statusCode: 429 })
  }

  // Generate, hash, and store new code atomically with invalidation
  const code = generateOtp()
  const codeHash = hashCode(code)
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000)

  // Transaction prevents race condition where concurrent /send requests
  // could leave multiple active codes for the same email.
  await db.transaction(async (tx) => {
    await tx
      .update(otpCodes)
      .set({ usedAt: new Date() })
      .where(and(eq(otpCodes.email, normalizedEmail), isNull(otpCodes.usedAt)))

    await tx.insert(otpCodes).values({
      email: normalizedEmail,
      codeHash,
      expiresAt,
    })
  })

  // Send code via email (outside transaction — email delivery shouldn't roll back DB)
  await sendOtpEmail({ to: normalizedEmail, code })

  // Audit log (swallow errors — audit failure must not break the flow)
  await writeAuditLog(db, {
    action: 'otp.send',
    resource: 'otp',
    metadata: { emailHash: hashEmail(normalizedEmail) },
    ipAddress,
    userAgent,
  })
}

/**
 * Verify a 6-digit OTP code against the stored hash.
 * On success: find-or-create Firebase user, create custom token,
 * find-or-create DB user, return { customToken, user }.
 */
export async function verifyOtp(
  db: DrizzleDb,
  email: string,
  code: string,
  ipAddress?: string,
  userAgent?: string,
  logger?: {
    warn: (obj: Record<string, unknown>, msg: string) => void
    error: (obj: Record<string, unknown>, msg: string) => void
  },
): Promise<{ customToken: string; user: typeof users.$inferSelect }> {
  const normalizedEmail = email.toLowerCase().trim()

  // Per-email aggregate lockout: prevents distributed brute-force across rotating IPs.
  // SUM(attempts) across all codes for this email within the lockout window.
  const lockoutCutoff = new Date(Date.now() - LOCKOUT_WINDOW_MINUTES * 60 * 1000)
  const [lockoutRow] = await db
    .select({ totalAttempts: sum(otpCodes.attempts) })
    .from(otpCodes)
    .where(and(eq(otpCodes.email, normalizedEmail), gt(otpCodes.createdAt, lockoutCutoff)))

  const totalAttempts = Number(lockoutRow?.totalAttempts ?? 0)
  if (totalAttempts >= MAX_VERIFY_FAILURES_PER_EMAIL) {
    await writeAuditLog(db, {
      action: 'otp.verify.lockout',
      resource: 'otp',
      metadata: { emailHash: hashEmail(normalizedEmail), totalAttempts },
      ipAddress,
      userAgent,
    })
    throw Object.assign(new Error('Too many attempts. Request a new code.'), { statusCode: 401 })
  }

  // Find latest unexpired, unused code for this email
  const [otpRow] = await db
    .select()
    .from(otpCodes)
    .where(
      and(
        eq(otpCodes.email, normalizedEmail),
        isNull(otpCodes.usedAt),
        gt(otpCodes.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(otpCodes.createdAt))
    .limit(1)

  if (!otpRow) {
    throw Object.assign(new Error('Code expired or not found'), { statusCode: 401 })
  }

  // Brute-force lockout
  if (otpRow.attempts >= MAX_ATTEMPTS) {
    throw Object.assign(new Error('Too many attempts. Request a new code.'), { statusCode: 401 })
  }

  // Timing-safe comparison of hashes
  const inputHash = hashCode(code)
  const storedHashBuf = Buffer.from(otpRow.codeHash, 'hex')
  const inputHashBuf = Buffer.from(inputHash, 'hex')
  const isValid = crypto.timingSafeEqual(storedHashBuf, inputHashBuf)

  if (!isValid) {
    // Increment attempts counter
    await db
      .update(otpCodes)
      .set({ attempts: sql`${otpCodes.attempts} + 1` })
      .where(eq(otpCodes.id, otpRow.id))

    // Audit failed attempt
    await writeAuditLog(db, {
      action: 'otp.verify.fail',
      resource: 'otp',
      metadata: { emailHash: hashEmail(normalizedEmail), reason: 'invalid_code' },
      ipAddress,
      userAgent,
    })

    throw Object.assign(new Error('Invalid code'), { statusCode: 401 })
  }

  // Atomically mark code as used — re-check usedAt IS NULL to prevent TOCTOU race
  const [consumed] = await db
    .update(otpCodes)
    .set({ usedAt: new Date() })
    .where(and(eq(otpCodes.id, otpRow.id), isNull(otpCodes.usedAt)))
    .returning()

  if (!consumed) {
    throw Object.assign(new Error('Code expired or not found'), { statusCode: 401 })
  }

  // Find or create Firebase user
  const firebaseUid = await findOrCreateFirebaseUser(normalizedEmail)

  // Create custom token for mobile sign-in
  const customToken = await firebaseAuth.createCustomToken(firebaseUid)

  // Find or create DB user (upsert) — uses shared upsertDbUser
  const user = await upsertDbUser(db, firebaseUid, normalizedEmail)

  // Set custom claims
  try {
    await firebaseAuth.setCustomUserClaims(firebaseUid, {
      role: user.role,
      tier: user.tier,
    })
  } catch (err) {
    // Claims sync failure is non-critical — will sync on next /v1/auth/sync
    // But log as error (not warn) to trigger alerting if it's persistent
    logger?.error({ err, firebaseUid, userId: user.id }, 'Failed to set custom user claims')
  }

  // Audit successful verification
  await writeAuditLog(db, {
    userId: user.id,
    action: 'otp.verify.success',
    resource: 'otp',
    resourceId: user.id,
    ipAddress,
    userAgent,
  })

  return { customToken, user }
}

/** Look up Firebase user by email, or create a new one. */
async function findOrCreateFirebaseUser(email: string): Promise<string> {
  try {
    const existingUser = await firebaseAuth.getUserByEmail(email)
    return existingUser.uid
  } catch (err: unknown) {
    const firebaseError = err as { code?: string }
    if (firebaseError.code === 'auth/user-not-found') {
      const newUser = await firebaseAuth.createUser({
        email,
        emailVerified: true,
      })
      return newUser.uid
    }
    throw err
  }
}

const DEFAULT_RETENTION_HOURS = 24

/**
 * Delete OTP codes older than the retention period.
 * Returns the number of deleted rows.
 */
export async function cleanupExpiredOtps(
  db: DrizzleDb,
  retentionHours: number = DEFAULT_RETENTION_HOURS,
): Promise<number> {
  const cutoff = new Date(Date.now() - retentionHours * 60 * 60 * 1000)
  const deleted = await db
    .delete(otpCodes)
    .where(lt(otpCodes.createdAt, cutoff))
    .returning({ id: otpCodes.id })

  return deleted.length
}
