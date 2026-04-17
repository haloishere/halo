import { eq, and, inArray, sql } from 'drizzle-orm'
import type { FastifyBaseLogger } from 'fastify'
import type { DrizzleDb } from '../../db/types.js'
import { userContentProgress } from '../../db/schema/user-content-progress.js'

export type ContentProgressRecord = typeof userContentProgress.$inferSelect

// ─── Update Progress ───────────────────────────────────────────────────────────

export async function updateProgress(
  db: DrizzleDb,
  userId: string,
  contentItemId: string,
  progressPercent: number,
  logger?: FastifyBaseLogger,
): Promise<ContentProgressRecord> {
  const completedAt = progressPercent >= 100 ? new Date() : null

  const rows = await db
    .insert(userContentProgress)
    .values({ userId, contentItemId, progressPercent, completedAt })
    .onConflictDoUpdate({
      target: [userContentProgress.userId, userContentProgress.contentItemId],
      set: {
        progressPercent: sql`GREATEST(${userContentProgress.progressPercent}, ${progressPercent})`,
        completedAt: sql`CASE WHEN GREATEST(${userContentProgress.progressPercent}, ${progressPercent}) >= 100 THEN COALESCE(${userContentProgress.completedAt}, now()) ELSE ${userContentProgress.completedAt} END`,
      },
    })
    .returning()

  const record = rows[0]
  if (!record) {
    throw new Error('Failed to update progress')
  }

  logger?.info({ contentItemId, progressPercent }, 'Progress updated')
  return record
}

// ─── Batch Progress ────────────────────────────────────────────────────────────

export async function getProgressBatch(
  db: DrizzleDb,
  userId: string,
  contentItemIds: string[],
): Promise<Map<string, number>> {
  if (contentItemIds.length === 0) return new Map()

  const rows = await db
    .select({
      contentItemId: userContentProgress.contentItemId,
      progressPercent: userContentProgress.progressPercent,
    })
    .from(userContentProgress)
    .where(
      and(
        eq(userContentProgress.userId, userId),
        inArray(userContentProgress.contentItemId, contentItemIds),
      ),
    )

  return new Map(rows.map((r) => [r.contentItemId, r.progressPercent]))
}
