/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { dailyTipSchema } from '@halo/shared'

const { getRandomTip, FALLBACK_TIPS } = await import('../tips.service.js')

function makeMockDb() {
  return {
    select: vi.fn(),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getRandomTip', () => {
  it("returns a tip from today's pool", async () => {
    const mockDb = makeMockDb()

    const todayTip = { tip: 'Take a break today.', category: 'Self Care' }

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([todayTip]),
          }),
        }),
      }),
    })

    const result = await getRandomTip(mockDb as any)

    expect(result.tip).toBe('Take a break today.')
    expect(result.category).toBe('Self Care')
  })

  it("falls back to yesterday's tips if none for today", async () => {
    const mockDb = makeMockDb()

    const yesterdayTip = { tip: 'Yesterday tip.', category: 'Daily Care' }

    // First call (today) returns empty, second call (yesterday) returns a tip
    let callCount = 0
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(() => {
          callCount++
          return {
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(callCount === 1 ? [] : [yesterdayTip]),
            }),
          }
        }),
      }),
    })

    const result = await getRandomTip(mockDb as any)

    expect(result.tip).toBe('Yesterday tip.')
    expect(result.category).toBe('Daily Care')
  })

  it('falls back to static FALLBACK_TIPS if no DB tips at all', async () => {
    const mockDb = makeMockDb()

    // Both today and yesterday return empty
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    })

    const result = await getRandomTip(mockDb as any)

    // Result should be one of the FALLBACK_TIPS
    const isFallback = FALLBACK_TIPS.some(
      (ft: any) => ft.tip === result.tip && ft.category === result.category,
    )
    expect(isFallback).toBe(true)
  })

  it('propagates DB errors to caller (not silently swallowed)', async () => {
    const mockDb = makeMockDb()

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(() => {
          throw new Error('DB connection failed')
        }),
      }),
    })

    await expect(getRandomTip(mockDb as any)).rejects.toThrow('DB connection failed')
  })

  it('returned tip matches dailyTipSchema shape', async () => {
    const mockDb = makeMockDb()

    const todayTip = { tip: 'Stay hydrated throughout the day.', category: 'Self Care' }

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([todayTip]),
          }),
        }),
      }),
    })

    const result = await getRandomTip(mockDb as any)

    const parsed = dailyTipSchema.safeParse(result)
    expect(parsed.success).toBe(true)
  })

  it('FALLBACK_TIPS all pass dailyTipSchema validation', () => {
    for (const tip of FALLBACK_TIPS) {
      const parsed = dailyTipSchema.safeParse(tip)
      expect(parsed.success).toBe(true)
    }
  })
})
