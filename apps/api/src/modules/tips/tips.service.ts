import { eq, sql } from 'drizzle-orm'
import type { FastifyBaseLogger } from 'fastify'
import { dailyTips } from '../../db/schema/daily-tips.js'
import type { DrizzleDb } from '../../db/types.js'
import type { DailyTip } from '@halo/shared'
import { todayDateString, yesterdayDateString } from '../../lib/date-utils.js'

export const FALLBACK_TIPS: DailyTip[] = [
  {
    tip: 'Take 10 minutes today just for yourself — a short walk, deep breaths, or a cup of tea.',
    category: 'Self Care',
  },
  {
    tip: 'Try using simple, short sentences when communicating. A warm tone matters more than words.',
    category: 'Communication',
  },
  {
    tip: 'Keep a consistent daily routine — predictability helps reduce anxiety and confusion.',
    category: 'Daily Care',
  },
  {
    tip: 'Label cabinets and drawers with pictures or words to help with navigation at home.',
    category: 'Safety',
  },
  {
    tip: "It's okay to feel frustrated. Acknowledge your emotions — they don't make you a bad caregiver.",
    category: 'Emotional',
  },
  {
    tip: 'Play familiar music from their younger years — it can spark memories and improve mood.',
    category: 'Communication',
  },
  {
    tip: 'Reach out to a support group this week. Connecting with others who understand truly helps.',
    category: 'Self Care',
  },
]

function fallbackTip(): DailyTip {
  const dayIndex = new Date().getDay()
  return FALLBACK_TIPS[dayIndex % FALLBACK_TIPS.length]!
}

async function queryTipByDate(db: DrizzleDb, dateStr: string): Promise<DailyTip | null> {
  const rows = await db
    .select({ tip: dailyTips.tip, category: dailyTips.category })
    .from(dailyTips)
    .where(eq(dailyTips.tipDate, dateStr))
    .orderBy(sql`random()`)
    .limit(1)

  if (rows.length === 0) return null

  return { tip: rows[0]!.tip, category: rows[0]!.category as DailyTip['category'] }
}

export async function getRandomTip(db: DrizzleDb, logger?: FastifyBaseLogger): Promise<DailyTip> {
  // DB errors propagate to Fastify error handler (Sentry + 500).
  // Fallback is only used when the DB is healthy but has no tips yet.
  const todayTip = await queryTipByDate(db, todayDateString())
  if (todayTip) return todayTip

  const yesterdayTip = await queryTipByDate(db, yesterdayDateString())
  if (yesterdayTip) return yesterdayTip

  logger?.info('No tips found for today or yesterday, serving static fallback')
  return fallbackTip()
}
