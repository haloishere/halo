import type { FastifyRequest, FastifyReply } from 'fastify'
import { USER_ROLES, USER_TIERS } from '@halo/shared'
import type { UserRole, UserTier } from '@halo/shared'
import { eq } from 'drizzle-orm'
import { firebaseAuth } from '../lib/firebase-admin.js'
import { users } from '../db/schema/index.js'

export interface AuthUser {
  uid: string
  email: string
  role: UserRole
  tier: UserTier
  dbUserId?: string
}

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthUser
  }
}

export async function verifyAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply
      .code(401)
      .send({ success: false, error: 'Missing or invalid authorization header' })
  }

  const token = authHeader.slice(7)

  let decodedToken: { uid: string; email?: string; [key: string]: unknown }
  try {
    decodedToken = await firebaseAuth.verifyIdToken(token)
  } catch (err) {
    // Firebase auth errors have a 'code' property starting with 'auth/'
    const isAuthError =
      err instanceof Error &&
      'code' in err &&
      typeof (err as { code: unknown }).code === 'string' &&
      (err as { code: string }).code.startsWith('auth/')
    // Plain Error without code is also a token validation error (e.g., malformed JWT)
    const isTokenError = err instanceof Error && !('code' in err)

    if (isAuthError || isTokenError) {
      return reply.code(401).send({ success: false, error: 'Invalid or expired token' })
    }

    // Non-auth errors (ADC init failure, network, SDK bugs) should be 500
    request.log?.error?.({ err }, 'Firebase Admin SDK error during token verification')
    throw err
  }

  request.user = {
    uid: decodedToken.uid,
    email: decodedToken.email ?? '',
    role: USER_ROLES.includes(decodedToken['role'] as UserRole)
      ? (decodedToken['role'] as UserRole)
      : 'user',
    tier: USER_TIERS.includes(decodedToken['tier'] as UserTier)
      ? (decodedToken['tier'] as UserTier)
      : 'free',
  }

  // Resolve database user ID and sync role/tier from DB (authoritative source)
  if (request.server?.hasDecorator?.('db')) {
    try {
      const [dbUser] = await request.server.db
        .select({ id: users.id, role: users.role, tier: users.tier })
        .from(users)
        .where(eq(users.firebaseUid, decodedToken.uid))
        .limit(1)
      if (dbUser) {
        request.user.dbUserId = dbUser.id
        request.user.role = dbUser.role as UserRole
        request.user.tier = dbUser.tier as UserTier
      }
    } catch (err) {
      // H2: Log warning instead of silently swallowing
      request.log?.warn?.(
        { uid: decodedToken.uid, err },
        'DB user lookup failed — proceeding with Firebase claims only',
      )
    }
  }
}

/**
 * PreHandler that rejects requests when the DB user was not resolved.
 * Chain after verifyAuth on routes that need a database user ID.
 */
export async function requireDbUser(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!request.user?.dbUserId) {
    return reply
      .code(401)
      .send({ success: false, error: 'User account not found. Please register first.' })
  }
}

export function requireRole(...roles: UserRole[]) {
  return async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!request.user || !roles.includes(request.user.role)) {
      return reply.code(403).send({ success: false, error: 'Insufficient permissions' })
    }
  }
}
