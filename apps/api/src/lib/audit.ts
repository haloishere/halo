import { createHash } from 'crypto'
import pino from 'pino'
import type { DrizzleDb } from '../db/types.js'
import { auditLogs } from '../db/schema/index.js'

interface ErrorLogger {
  error: (obj: Record<string, unknown>, msg: string) => void
}

const fallbackLogger: ErrorLogger = pino({ name: 'audit' })

export interface AuditLogEntry {
  userId?: string
  action: string
  resource: string
  resourceId?: string
  metadata?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
}

export async function writeAuditLog(
  db: DrizzleDb,
  entry: AuditLogEntry,
  logger: ErrorLogger = fallbackLogger,
): Promise<void> {
  const hashedIp = entry.ipAddress
    ? createHash('sha256').update(entry.ipAddress).digest('hex')
    : null

  try {
    await db.insert(auditLogs).values({
      userId: entry.userId ?? null,
      action: entry.action,
      resource: entry.resource,
      resourceId: entry.resourceId ?? null,
      metadata: entry.metadata ?? null,
      ipAddress: hashedIp,
      userAgent: entry.userAgent ? entry.userAgent.slice(0, 512) : null,
    })
  } catch (err) {
    // Audit failure must NOT break the auth flow — log and continue
    logger.error(
      { action: entry.action, resource: entry.resource, err },
      'Failed to write audit log',
    )
  }
}
