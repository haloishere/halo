import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DIAGNOSIS_STAGES } from '@halo/shared'
import { syncToContentItems, deleteFromContentItems } from './syncToContentItems'

// Mock lexicalToMarkdown to isolate hook logic from Lexical/Payload richtext internals
vi.mock('../lib/lexicalToMarkdown', () => ({
  lexicalToMarkdown: vi.fn().mockResolvedValue('# Mocked markdown body'),
}))

import { lexicalToMarkdown } from '../lib/lexicalToMarkdown'

const mockLexicalToMarkdown = vi.mocked(lexicalToMarkdown)

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function createMockPool() {
  return { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 1 }) }
}

function createMockPayload(pool: ReturnType<typeof createMockPool>) {
  return {
    db: { pool },
    config: { serverURL: 'http://test' },
    findByID: vi.fn().mockResolvedValue(null),
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  }
}

interface DocOverrides {
  _status?: string
  title?: string
  slug?: string
  body?: unknown
  category?: string
  diagnosisStages?: unknown
  videoUrl?: string | null
  thumbnail?: unknown
}

function createDoc(overrides: DocOverrides = {}) {
  return {
    _status: 'published',
    title: 'Test Article',
    slug: 'test-article',
    body: { root: { type: 'root', children: [] } },
    category: 'daily_care',
    diagnosisStages: ['early', 'middle'],
    videoUrl: null,
    thumbnail: null,
    ...overrides,
  }
}

function createHookArgs(
  doc: ReturnType<typeof createDoc>,
  pool: ReturnType<typeof createMockPool>,
  contextOverrides: Record<string, unknown> = {},
  previousDoc: Record<string, unknown> = {},
) {
  const payload = createMockPayload(pool)
  return {
    doc,
    req: { payload },
    operation: 'update' as const,
    context: { ...contextOverrides },
    collection: {} as never,
    previousDoc,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

function createDeleteHookArgs(
  doc: ReturnType<typeof createDoc>,
  pool: ReturnType<typeof createMockPool>,
) {
  const payload = createMockPayload(pool)
  return {
    doc,
    req: { payload },
    id: 'some-id',
    collection: {} as never,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

// ---------------------------------------------------------------------------
// syncToContentItems tests
// ---------------------------------------------------------------------------

describe('syncToContentItems', () => {
  let pool: ReturnType<typeof createMockPool>

  beforeEach(() => {
    vi.clearAllMocks()
    pool = createMockPool()
    mockLexicalToMarkdown.mockResolvedValue('# Mocked markdown body')
  })

  describe('guard clauses', () => {
    it('returns early when context.syncingToContentItems is set (prevents recursion)', async () => {
      const doc = createDoc()
      const args = createHookArgs(doc, pool, { syncingToContentItems: true })

      await syncToContentItems(args)

      expect(pool.query).not.toHaveBeenCalled()
    })

    it('returns early when doc._status is not published', async () => {
      const doc = createDoc({ _status: 'draft' })
      const args = createHookArgs(doc, pool)

      await syncToContentItems(args)

      expect(pool.query).not.toHaveBeenCalled()
    })

    it('returns early when _status is undefined', async () => {
      const doc = createDoc({ _status: undefined })
      const args = createHookArgs(doc, pool)

      await syncToContentItems(args)

      expect(pool.query).not.toHaveBeenCalled()
    })
  })

  describe('successful sync', () => {
    it('calls pool.query with UPSERT SQL and correct parameters', async () => {
      const doc = createDoc()
      const args = createHookArgs(doc, pool)

      await syncToContentItems(args)

      expect(pool.query).toHaveBeenCalledTimes(1)
      const [sql, params] = pool.query.mock.calls[0]!

      // Verify the SQL contains the UPSERT pattern
      expect(sql).toContain('INSERT INTO public.content_items')
      expect(sql).toContain('ON CONFLICT (slug) DO UPDATE')

      // Verify parameter values
      expect(params[0]).toBe('Test Article') // title
      expect(params[1]).toBe('test-article') // slug
      expect(params[2]).toBe('# Mocked markdown body') // body (from mock)
      expect(params[3]).toBe('daily_care') // category
      expect(params[4]).toBe('{early,middle}') // stages array
      expect(params[5]).toBeNull() // videoUrl
      expect(params[6]).toBeNull() // thumbnailUrl
      expect(typeof params[7]).toBe('string') // now (ISO string)
    })

    it('calls lexicalToMarkdown with doc.body and payload config', async () => {
      const doc = createDoc()
      const args = createHookArgs(doc, pool)

      await syncToContentItems(args)

      expect(mockLexicalToMarkdown).toHaveBeenCalledWith(doc.body, args.req.payload.config)
    })

    it('logs success with slug and operation', async () => {
      const doc = createDoc()
      const args = createHookArgs(doc, pool)

      await syncToContentItems(args)

      expect(args.req.payload.logger.info).toHaveBeenCalledWith(
        'Synced article "test-article" to content_items (update)',
      )
    })
  })

  describe('diagnosisStages validation', () => {
    it('filters out invalid diagnosis stages', async () => {
      const doc = createDoc({ diagnosisStages: ['early', 'invalid_stage', 'late'] })
      const args = createHookArgs(doc, pool)

      await syncToContentItems(args)

      const params = pool.query.mock.calls[0]![1]
      expect(params[4]).toBe('{early,late}')
    })

    it('handles all valid DIAGNOSIS_STAGES', async () => {
      const doc = createDoc({ diagnosisStages: [...DIAGNOSIS_STAGES] })
      const args = createHookArgs(doc, pool)

      await syncToContentItems(args)

      const params = pool.query.mock.calls[0]![1]
      expect(params[4]).toBe('{early,middle,late,unknown}')
    })

    it('handles empty diagnosisStages array', async () => {
      const doc = createDoc({ diagnosisStages: [] })
      const args = createHookArgs(doc, pool)

      await syncToContentItems(args)

      const params = pool.query.mock.calls[0]![1]
      expect(params[4]).toBe('{}')
    })

    it('handles non-array diagnosisStages (falls back to empty)', async () => {
      const doc = createDoc({ diagnosisStages: 'not-an-array' })
      const args = createHookArgs(doc, pool)

      await syncToContentItems(args)

      const params = pool.query.mock.calls[0]![1]
      expect(params[4]).toBe('{}')
    })

    it('handles null diagnosisStages', async () => {
      const doc = createDoc({ diagnosisStages: null as unknown as undefined })
      const args = createHookArgs(doc, pool)

      await syncToContentItems(args)

      const params = pool.query.mock.calls[0]![1]
      expect(params[4]).toBe('{}')
    })

    it('handles undefined diagnosisStages', async () => {
      const doc = createDoc({ diagnosisStages: undefined })
      const args = createHookArgs(doc, pool)

      await syncToContentItems(args)

      const params = pool.query.mock.calls[0]![1]
      expect(params[4]).toBe('{}')
    })

    it('filters non-string values from diagnosisStages', async () => {
      const doc = createDoc({ diagnosisStages: ['early', 123, null, 'late', true] })
      const args = createHookArgs(doc, pool)

      await syncToContentItems(args)

      const params = pool.query.mock.calls[0]![1]
      expect(params[4]).toBe('{early,late}')
    })
  })

  describe('videoUrl handling', () => {
    it('passes videoUrl when present', async () => {
      const doc = createDoc({ videoUrl: 'https://youtube.com/watch?v=abc' })
      const args = createHookArgs(doc, pool)

      await syncToContentItems(args)

      const params = pool.query.mock.calls[0]![1]
      expect(params[5]).toBe('https://youtube.com/watch?v=abc')
    })

    it('passes null when videoUrl is undefined', async () => {
      const doc = createDoc({ videoUrl: undefined })
      const args = createHookArgs(doc, pool)

      await syncToContentItems(args)

      const params = pool.query.mock.calls[0]![1]
      expect(params[5]).toBeNull()
    })

    it('passes null when videoUrl is null', async () => {
      const doc = createDoc({ videoUrl: null })
      const args = createHookArgs(doc, pool)

      await syncToContentItems(args)

      const params = pool.query.mock.calls[0]![1]
      expect(params[5]).toBeNull()
    })
  })

  describe('thumbnail handling', () => {
    it('extracts thumbnail URL with GCS prefix and card size', async () => {
      const doc = createDoc({
        thumbnail: {
          filename: 'original.jpg',
          sizes: { card: { filename: 'card-thumb.jpg' } },
        },
      })
      const args = createHookArgs(doc, pool)

      await syncToContentItems(args)

      const params = pool.query.mock.calls[0]![1]
      expect(params[6]).toBe('cms/card-thumb.jpg')
    })

    it('falls back to original filename when card size is missing', async () => {
      const doc = createDoc({
        thumbnail: {
          filename: 'original.jpg',
          sizes: {},
        },
      })
      const args = createHookArgs(doc, pool)

      await syncToContentItems(args)

      const params = pool.query.mock.calls[0]![1]
      expect(params[6]).toBe('cms/original.jpg')
    })

    it('falls back to original filename when sizes is undefined', async () => {
      const doc = createDoc({
        thumbnail: { filename: 'original.jpg' },
      })
      const args = createHookArgs(doc, pool)

      await syncToContentItems(args)

      const params = pool.query.mock.calls[0]![1]
      expect(params[6]).toBe('cms/original.jpg')
    })

    it('uses GCS_MEDIA_PREFIX env var when set', async () => {
      const originalEnv = process.env.GCS_MEDIA_PREFIX
      process.env.GCS_MEDIA_PREFIX = 'media/articles'

      try {
        const doc = createDoc({
          thumbnail: { filename: 'photo.jpg' },
        })
        const args = createHookArgs(doc, pool)

        await syncToContentItems(args)

        const params = pool.query.mock.calls[0]![1]
        expect(params[6]).toBe('media/articles/photo.jpg')
      } finally {
        if (originalEnv === undefined) {
          delete process.env.GCS_MEDIA_PREFIX
        } else {
          process.env.GCS_MEDIA_PREFIX = originalEnv
        }
      }
    })

    it('passes null when thumbnail is null', async () => {
      const doc = createDoc({ thumbnail: null })
      const args = createHookArgs(doc, pool)

      await syncToContentItems(args)

      const params = pool.query.mock.calls[0]![1]
      expect(params[6]).toBeNull()
    })

    it('populates thumbnail via payload.findByID when thumbnail is a string ID', async () => {
      const doc = createDoc({ thumbnail: 'some-id-string' })
      const args = createHookArgs(doc, pool)
      args.req.payload.findByID.mockResolvedValueOnce({
        filename: 'resolved.jpg',
        sizes: { card: { filename: 'resolved-card.jpg' } },
      })

      await syncToContentItems(args)

      expect(args.req.payload.findByID).toHaveBeenCalledWith({
        collection: 'cms-media',
        id: 'some-id-string',
        disableErrors: true,
        overrideAccess: true,
      })
      const params = pool.query.mock.calls[0]![1]
      expect(params[6]).toBe('cms/resolved-card.jpg')
    })

    it('populates thumbnail via payload.findByID when thumbnail is a numeric ID', async () => {
      const doc = createDoc({ thumbnail: 42 })
      const args = createHookArgs(doc, pool)
      args.req.payload.findByID.mockResolvedValueOnce({
        filename: 'photo.jpg',
        sizes: { card: { filename: 'photo-card.jpg' } },
      })

      await syncToContentItems(args)

      expect(args.req.payload.findByID).toHaveBeenCalledWith({
        collection: 'cms-media',
        id: 42,
        disableErrors: true,
        overrideAccess: true,
      })
      const params = pool.query.mock.calls[0]![1]
      expect(params[6]).toBe('cms/photo-card.jpg')
    })

    it('falls back to original filename when findByID returns no card size', async () => {
      const doc = createDoc({ thumbnail: 42 })
      const args = createHookArgs(doc, pool)
      args.req.payload.findByID.mockResolvedValueOnce({
        filename: 'original.jpg',
        sizes: {},
      })

      await syncToContentItems(args)

      const params = pool.query.mock.calls[0]![1]
      expect(params[6]).toBe('cms/original.jpg')
    })

    it('passes null when findByID returns media with no filename', async () => {
      const doc = createDoc({ thumbnail: 42 })
      const args = createHookArgs(doc, pool)
      args.req.payload.findByID.mockResolvedValueOnce({ id: 42, url: '/media/photo.jpg' })

      await syncToContentItems(args)

      const params = pool.query.mock.calls[0]![1]
      expect(params[6]).toBeNull()
    })

    it('syncs with null thumbnail when findByID returns null (deleted media)', async () => {
      const doc = createDoc({ thumbnail: 99 })
      const args = createHookArgs(doc, pool)
      args.req.payload.findByID.mockResolvedValueOnce(null)

      await syncToContentItems(args)

      // Article still syncs — thumbnail degrades to null
      expect(pool.query).toHaveBeenCalledTimes(1)
      const params = pool.query.mock.calls[0]![1]
      expect(params[6]).toBeNull()
    })

    it('logs warning when thumbnail ID exists but cannot be resolved', async () => {
      const doc = createDoc({ thumbnail: 99, slug: 'orphaned-thumb' })
      const args = createHookArgs(doc, pool)
      args.req.payload.findByID.mockResolvedValueOnce(null)

      await syncToContentItems(args)

      expect(args.req.payload.logger.warn).toHaveBeenCalledWith(
        { thumbnailId: 99, slug: 'orphaned-thumb' },
        'Thumbnail media for article "orphaned-thumb" could not be resolved — syncing without thumbnail',
      )
    })

    it('syncs without thumbnail when findByID throws (e.g. DB timeout)', async () => {
      const doc = createDoc({ thumbnail: 42, slug: 'db-blip' })
      const args = createHookArgs(doc, pool)
      args.req.payload.findByID.mockRejectedValueOnce(new Error('connection timeout'))

      await syncToContentItems(args)

      // Article still syncs — thumbnail degrades to null
      expect(pool.query).toHaveBeenCalledTimes(1)
      const params = pool.query.mock.calls[0]![1]
      expect(params[6]).toBeNull()

      expect(args.req.payload.logger.error).toHaveBeenCalledWith(
        { err: expect.any(Error), thumbnailId: 42, slug: 'db-blip' },
        'Failed to resolve thumbnail media for article "db-blip" — syncing without thumbnail',
      )
    })

    it('does not call findByID when thumbnail is already a populated object', async () => {
      const doc = createDoc({
        thumbnail: { filename: 'already-populated.jpg', sizes: {} },
      })
      const args = createHookArgs(doc, pool)

      await syncToContentItems(args)

      expect(args.req.payload.findByID).not.toHaveBeenCalled()
      const params = pool.query.mock.calls[0]![1]
      expect(params[6]).toBe('cms/already-populated.jpg')
    })

    it('passes null when thumbnail object has no filename', async () => {
      const doc = createDoc({
        thumbnail: { id: '123', url: '/media/photo.jpg' },
      })
      const args = createHookArgs(doc, pool)

      await syncToContentItems(args)

      const params = pool.query.mock.calls[0]![1]
      expect(params[6]).toBeNull()
    })
  })

  describe('db pool fallback', () => {
    it('uses db.client when db.pool is not available', async () => {
      const mockClient = { query: vi.fn().mockResolvedValue({ rows: [] }) }
      const payload = {
        db: { client: mockClient },
        config: { serverURL: 'http://test' },
        logger: { info: vi.fn(), error: vi.fn() },
      }
      const doc = createDoc()
      const args = {
        doc,
        req: { payload },
        operation: 'create' as const,
        context: {},
        collection: {} as never,
        previousDoc: {} as never,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any

      await syncToContentItems(args)

      expect(mockClient.query).toHaveBeenCalledTimes(1)
    })
  })

  describe('error handling', () => {
    it('throws when pool.query fails', async () => {
      pool.query.mockRejectedValueOnce(new Error('Connection refused'))
      const doc = createDoc()
      const args = createHookArgs(doc, pool)

      await expect(syncToContentItems(args)).rejects.toThrow('Connection refused')
    })

    it('logs error with slug before throwing', async () => {
      pool.query.mockRejectedValueOnce(new Error('DB error'))
      const doc = createDoc({ slug: 'failing-article' })
      const args = createHookArgs(doc, pool)

      await expect(syncToContentItems(args)).rejects.toThrow('DB error')

      expect(args.req.payload.logger.error).toHaveBeenCalledWith(
        { err: expect.any(Error), slug: 'failing-article' },
        'Failed to sync article "failing-article" to content_items',
      )
    })

    it('throws when lexicalToMarkdown fails', async () => {
      mockLexicalToMarkdown.mockRejectedValueOnce(new Error('Parse error'))
      const doc = createDoc()
      const args = createHookArgs(doc, pool)

      await expect(syncToContentItems(args)).rejects.toThrow('Parse error')
    })
  })

  describe('now timestamp', () => {
    it('passes an ISO 8601 date string as the timestamp parameter', async () => {
      const doc = createDoc()
      const args = createHookArgs(doc, pool)

      await syncToContentItems(args)

      const params = pool.query.mock.calls[0]![1]
      const now = params[7] as string
      // Should be a valid ISO 8601 string
      expect(new Date(now).toISOString()).toBe(now)
    })
  })
})

// ---------------------------------------------------------------------------
// unpublish flow tests
// ---------------------------------------------------------------------------

describe('syncToContentItems — unpublish flow', () => {
  let pool: ReturnType<typeof createMockPool>

  beforeEach(() => {
    vi.clearAllMocks()
    pool = createMockPool()
  })

  it('deletes from content_items when article changes from published to draft', async () => {
    const doc = createDoc({ _status: 'draft', slug: 'unpublished-article' })
    const args = createHookArgs(
      doc,
      pool,
      {},
      { _status: 'published', slug: 'unpublished-article' },
    )

    await syncToContentItems(args)

    expect(pool.query).toHaveBeenCalledTimes(1)
    const [sql, params] = pool.query.mock.calls[0]!
    expect(sql).toContain('DELETE FROM public.content_items WHERE slug = $1')
    expect(params).toEqual(['unpublished-article'])
  })

  it('logs success when unpublishing', async () => {
    const doc = createDoc({ _status: 'draft', slug: 'my-article' })
    const args = createHookArgs(doc, pool, {}, { _status: 'published', slug: 'my-article' })

    await syncToContentItems(args)

    expect(args.req.payload.logger.info).toHaveBeenCalledWith(
      'Unpublished article "my-article" removed from content_items',
    )
  })

  it('does NOT delete when article was already draft', async () => {
    const doc = createDoc({ _status: 'draft' })
    const args = createHookArgs(doc, pool, {}, { _status: 'draft' })

    await syncToContentItems(args)

    expect(pool.query).not.toHaveBeenCalled()
  })

  it('does NOT delete when previousDoc is undefined', async () => {
    const doc = createDoc({ _status: 'draft' })
    const args = createHookArgs(doc, pool, {})

    await syncToContentItems(args)

    expect(pool.query).not.toHaveBeenCalled()
  })

  it('throws on delete failure during unpublish', async () => {
    pool.query.mockRejectedValueOnce(new Error('Delete failed'))
    const doc = createDoc({ _status: 'draft', slug: 'fail-unpublish' })
    const args = createHookArgs(doc, pool, {}, { _status: 'published', slug: 'fail-unpublish' })

    await expect(syncToContentItems(args)).rejects.toThrow('Delete failed')
  })

  it('logs error before throwing on unpublish failure', async () => {
    pool.query.mockRejectedValueOnce(new Error('DB error'))
    const doc = createDoc({ _status: 'draft', slug: 'error-slug' })
    const args = createHookArgs(doc, pool, {}, { _status: 'published', slug: 'error-slug' })

    await expect(syncToContentItems(args)).rejects.toThrow('DB error')

    expect(args.req.payload.logger.error).toHaveBeenCalledWith(
      { err: expect.any(Error), slug: 'error-slug' },
      'Failed to remove unpublished article "error-slug" from content_items',
    )
  })
})

// ---------------------------------------------------------------------------
// deleteFromContentItems tests
// ---------------------------------------------------------------------------

describe('deleteFromContentItems', () => {
  let pool: ReturnType<typeof createMockPool>

  beforeEach(() => {
    vi.clearAllMocks()
    pool = createMockPool()
  })

  it('executes DELETE SQL with the doc slug', async () => {
    const doc = createDoc({ slug: 'article-to-delete' })
    const args = createDeleteHookArgs(doc, pool)

    await deleteFromContentItems(args)

    expect(pool.query).toHaveBeenCalledTimes(1)
    const [sql, params] = pool.query.mock.calls[0]!
    expect(sql).toContain('DELETE FROM public.content_items WHERE slug = $1')
    expect(params).toEqual(['article-to-delete'])
  })

  it('logs success with the deleted slug', async () => {
    const doc = createDoc({ slug: 'deleted-one' })
    const args = createDeleteHookArgs(doc, pool)

    await deleteFromContentItems(args)

    expect(args.req.payload.logger.info).toHaveBeenCalledWith(
      'Deleted article "deleted-one" from content_items',
    )
  })

  it('throws when pool.query fails', async () => {
    pool.query.mockRejectedValueOnce(new Error('Delete failed'))
    const doc = createDoc({ slug: 'fail-delete' })
    const args = createDeleteHookArgs(doc, pool)

    await expect(deleteFromContentItems(args)).rejects.toThrow('Delete failed')
  })

  it('logs error with slug before throwing', async () => {
    pool.query.mockRejectedValueOnce(new Error('Delete DB error'))
    const doc = createDoc({ slug: 'error-slug' })
    const args = createDeleteHookArgs(doc, pool)

    await expect(deleteFromContentItems(args)).rejects.toThrow('Delete DB error')

    expect(args.req.payload.logger.error).toHaveBeenCalledWith(
      { err: expect.any(Error), slug: 'error-slug' },
      'Failed to delete article "error-slug" from content_items',
    )
  })

  it('uses db.client when db.pool is not available', async () => {
    const mockClient = { query: vi.fn().mockResolvedValue({ rows: [] }) }
    const payload = {
      db: { client: mockClient },
      logger: { info: vi.fn(), error: vi.fn() },
    }
    const doc = createDoc({ slug: 'client-fallback' })
    const args = {
      doc,
      req: { payload },
      id: 'some-id',
      collection: {} as never,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any

    await deleteFromContentItems(args)

    expect(mockClient.query).toHaveBeenCalledTimes(1)
    const params = mockClient.query.mock.calls[0]![1]
    expect(params).toEqual(['client-fallback'])
  })
})
