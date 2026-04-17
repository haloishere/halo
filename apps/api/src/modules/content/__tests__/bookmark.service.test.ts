/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createBookmarkFactory, createContentItemFactory } from '../../../test/factories/index.js'

const { toggleBookmark, getUserBookmarks, getBookmarkStatuses } =
  await import('../bookmark.service.js')

function mockDb() {
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn(),
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn(),
          }),
        }),
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn(),
            }),
          }),
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn(),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn(),
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

// ─── toggleBookmark ──────────────────────────────────────────────────────────

describe('toggleBookmark', () => {
  it('adds bookmark when not already bookmarked', async () => {
    const bookmark = createBookmarkFactory()
    const db = mockDb() as any
    // INSERT ON CONFLICT DO NOTHING returns the row — bookmark was new
    db.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([bookmark]),
        }),
      }),
    })

    const result = await toggleBookmark(db, bookmark.userId, bookmark.contentItemId)
    expect(result.bookmarked).toBe(true)
  })

  it('removes bookmark when already bookmarked', async () => {
    const bookmark = createBookmarkFactory()
    const db = mockDb() as any
    // INSERT ON CONFLICT DO NOTHING returns empty — already existed
    db.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    })
    db.delete.mockReturnValue({
      where: vi.fn().mockResolvedValue([bookmark]),
    })

    const result = await toggleBookmark(db, bookmark.userId, bookmark.contentItemId)
    expect(result.bookmarked).toBe(false)
  })
})

// ─── getUserBookmarks ────────────────────────────────────────────────────────

describe('getUserBookmarks', () => {
  it('returns paginated bookmarked content items', async () => {
    const items = Array.from({ length: 3 }, () => {
      const item = createContentItemFactory()
      const bookmark = createBookmarkFactory({ contentItemId: item.id })
      return { bookmarks: bookmark, content_items: item, user_content_progress: null }
    })
    const db = mockDb() as any
    db.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue(items),
              }),
            }),
          }),
        }),
      }),
    })

    const result = await getUserBookmarks(db, 'user-123', undefined, 20)
    expect(result.items).toHaveLength(3)
    expect(result.nextCursor).toBeNull()
  })
})

// ─── getBookmarkStatuses ─────────────────────────────────────────────────────

describe('getBookmarkStatuses', () => {
  it('returns set of bookmarked content item ids', async () => {
    const id1 = 'item-1'
    const id2 = 'item-2'
    const db = mockDb() as any
    db.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ contentItemId: id1 }, { contentItemId: id2 }]),
      }),
    })

    const result = await getBookmarkStatuses(db, 'user-123', [id1, id2, 'item-3'])
    expect(result.has(id1)).toBe(true)
    expect(result.has(id2)).toBe(true)
    expect(result.has('item-3')).toBe(false)
  })

  it('returns empty set when no bookmarks', async () => {
    const db = mockDb() as any
    db.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    })

    const result = await getBookmarkStatuses(db, 'user-123', ['item-1'])
    expect(result.size).toBe(0)
  })
})
