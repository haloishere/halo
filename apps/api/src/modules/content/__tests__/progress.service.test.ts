/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createContentProgressFactory } from '../../../test/factories/index.js'

const { updateProgress, getProgressBatch } = await import('../progress.service.js')

function mockDb() {
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn(),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: vi.fn().mockReturnValue({
          returning: vi.fn(),
        }),
      }),
    }),
  } as unknown
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ─── updateProgress ──────────────────────────────────────────────────────────

describe('updateProgress', () => {
  it('upserts progress and returns record', async () => {
    const progress = createContentProgressFactory({ progressPercent: 50 })
    const db = mockDb() as any
    db.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([progress]),
        }),
      }),
    })

    const result = await updateProgress(db, progress.userId, progress.contentItemId, 50)
    expect(result.progressPercent).toBe(50)
    expect(result.completedAt).toBeNull()
  })

  it('sets completedAt when progress is 100', async () => {
    const progress = createContentProgressFactory({
      progressPercent: 100,
      completedAt: new Date('2024-06-01T00:00:00Z'),
    })
    const db = mockDb() as any
    db.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([progress]),
        }),
      }),
    })

    const result = await updateProgress(db, progress.userId, progress.contentItemId, 100)
    expect(result.progressPercent).toBe(100)
    expect(result.completedAt).toBeTruthy()
  })

  it('clears completedAt when progress drops below 100', async () => {
    const progress = createContentProgressFactory({ progressPercent: 80, completedAt: null })
    const db = mockDb() as any
    db.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([progress]),
        }),
      }),
    })

    const result = await updateProgress(db, progress.userId, progress.contentItemId, 80)
    expect(result.progressPercent).toBe(80)
    expect(result.completedAt).toBeNull()
  })
})

// ─── getProgressBatch ────────────────────────────────────────────────────────

describe('getProgressBatch', () => {
  it('returns map of content item id to progress percent', async () => {
    const db = mockDb() as any
    db.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { contentItemId: 'item-1', progressPercent: 50 },
          { contentItemId: 'item-2', progressPercent: 100 },
        ]),
      }),
    })

    const result = await getProgressBatch(db, 'user-123', ['item-1', 'item-2', 'item-3'])
    expect(result.get('item-1')).toBe(50)
    expect(result.get('item-2')).toBe(100)
    expect(result.has('item-3')).toBe(false)
  })

  it('returns empty map when no progress records', async () => {
    const db = mockDb() as any
    db.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    })

    const result = await getProgressBatch(db, 'user-123', ['item-1'])
    expect(result.size).toBe(0)
  })
})
