/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createContentItemFactory } from '../../../test/factories/index.js'

const {
  listContent,
  getContentBySlug,
  getContentById,
  createContent,
  updateContent,
  deleteContent,
} = await import('../content.service.js')

function mockDb() {
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        leftJoin: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn(),
              }),
              limit: vi.fn(),
            }),
          }),
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn(),
            }),
            limit: vi.fn(),
          }),
        }),
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn(),
          }),
          limit: vi.fn(),
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn(),
        onConflictDoNothing: vi.fn().mockReturnValue({
          returning: vi.fn(),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn(),
        }),
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

// ─── listContent ─────────────────────────────────────────────────────────────

describe('listContent', () => {
  it('returns paginated content with nextCursor when more items exist', async () => {
    const items = Array.from({ length: 21 }, (_, i) =>
      createContentItemFactory({ title: `Article ${i}` }),
    )
    const db = mockDb() as any
    db.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        leftJoin: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue(
                  items.map((item) => ({
                    content_items: item,
                    bookmarks: null,
                    user_content_progress: null,
                  })),
                ),
              }),
            }),
          }),
        }),
      }),
    })

    const result = await listContent(db, { limit: 20 }, 'user-123')
    expect(result.items).toHaveLength(20)
    expect(result.nextCursor).toBeTruthy()
  })

  it('returns null nextCursor when no more items', async () => {
    const items = Array.from({ length: 5 }, (_, i) =>
      createContentItemFactory({ title: `Article ${i}` }),
    )
    const db = mockDb() as any
    db.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        leftJoin: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue(
                  items.map((item) => ({
                    content_items: item,
                    bookmarks: null,
                    user_content_progress: null,
                  })),
                ),
              }),
            }),
          }),
        }),
      }),
    })

    const result = await listContent(db, { limit: 20 }, 'user-123')
    expect(result.items).toHaveLength(5)
    expect(result.nextCursor).toBeNull()
  })

  it('returns empty array when no content exists', async () => {
    const db = mockDb() as any
    db.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        leftJoin: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      }),
    })

    const result = await listContent(db, { limit: 20 }, 'user-123')
    expect(result.items).toHaveLength(0)
    expect(result.nextCursor).toBeNull()
  })
})

// ─── getContentBySlug ────────────────────────────────────────────────────────

describe('getContentBySlug', () => {
  it('returns content item when found', async () => {
    const item = createContentItemFactory({ slug: 'sundowning-guide' })
    const db = mockDb() as any
    db.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        leftJoin: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                { content_items: item, bookmarks: null, user_content_progress: null },
              ]),
            }),
          }),
        }),
      }),
    })

    const result = await getContentBySlug(db, 'sundowning-guide', 'user-123')
    expect(result.slug).toBe('sundowning-guide')
  })

  it('throws 404 when slug not found', async () => {
    const db = mockDb() as any
    db.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        leftJoin: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      }),
    })

    await expect(getContentBySlug(db, 'nonexistent', 'user-123')).rejects.toMatchObject({
      statusCode: 404,
    })
  })
})

// ─── getContentById ──────────────────────────────────────────────────────────

describe('getContentById', () => {
  it('returns content item when found', async () => {
    const item = createContentItemFactory()
    const db = mockDb() as any
    db.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([item]),
        }),
      }),
    })

    const result = await getContentById(db, item.id)
    expect(result.id).toBe(item.id)
  })

  it('throws 404 when id not found', async () => {
    const db = mockDb() as any
    db.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    })

    await expect(getContentById(db, 'nonexistent-id')).rejects.toMatchObject({
      statusCode: 404,
    })
  })
})

// ─── createContent ───────────────────────────────────────────────────────────

describe('createContent', () => {
  it('inserts and returns new content', async () => {
    const item = createContentItemFactory()
    const db = mockDb() as any
    db.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([item]),
      }),
    })

    const result = await createContent(db, 'author-123', {
      title: item.title,
      slug: item.slug,
      body: item.body,
      category: item.category,
      diagnosisStages: [...item.diagnosisStages],
    })

    expect(result.id).toBe(item.id)
    expect(result.title).toBe(item.title)
  })

  it('throws 409 on duplicate slug', async () => {
    const db = mockDb() as any
    db.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockRejectedValue(
          Object.assign(new Error('duplicate key'), { code: '23505' }),
        ),
      }),
    })

    await expect(
      createContent(db, 'author-123', {
        title: 'Test',
        slug: 'duplicate-slug',
        body: 'Content',
        category: 'safety',
        diagnosisStages: ['early'],
      }),
    ).rejects.toMatchObject({ statusCode: 409 })
  })
})

// ─── updateContent ───────────────────────────────────────────────────────────

describe('updateContent', () => {
  it('updates and returns content', async () => {
    const item = createContentItemFactory({ title: 'Updated Title' })
    const db = mockDb() as any
    db.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([item]),
        }),
      }),
    })

    const result = await updateContent(db, item.id, { title: 'Updated Title' })
    expect(result.title).toBe('Updated Title')
  })

  it('throws 404 when item not found', async () => {
    const db = mockDb() as any
    db.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    })

    await expect(updateContent(db, 'nonexistent', { title: 'Updated' })).rejects.toMatchObject({
      statusCode: 404,
    })
  })

  it('throws 409 on duplicate slug', async () => {
    const db = mockDb() as any
    db.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockRejectedValue(
            Object.assign(new Error('duplicate key'), { code: '23505' }),
          ),
        }),
      }),
    })

    await expect(
      updateContent(db, 'some-id', { slug: 'duplicate-slug' }),
    ).rejects.toMatchObject({ statusCode: 409 })
  })
})

// ─── deleteContent ───────────────────────────────────────────────────────────

describe('deleteContent', () => {
  it('deletes content by id', async () => {
    const item = createContentItemFactory()
    const db = mockDb() as any
    db.delete.mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([item]),
      }),
    })

    await expect(deleteContent(db, item.id)).resolves.toBeUndefined()
  })

  it('throws 404 when item not found', async () => {
    const db = mockDb() as any
    db.delete.mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    })

    await expect(deleteContent(db, 'nonexistent')).rejects.toMatchObject({
      statusCode: 404,
    })
  })
})
