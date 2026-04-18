/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { mockFirebaseAuth } from '../../../test/mocks/index.js'
import { createContentItemFactory, createBookmarkFactory } from '../../../test/factories/index.js'

vi.mock('../../../lib/firebase-admin.js', () => ({
  firebaseAuth: mockFirebaseAuth,
}))

vi.mock('../../../lib/sentry.js', () => ({
  Sentry: { captureException: vi.fn() },
}))

const { createTestApp } = await import('../../../test/helpers.js')
const contentRoutes = (await import('../content.routes.js')).default

let app: FastifyInstance

const testItem = createContentItemFactory({ authorId: 'admin-uuid-1' })

function makeMockDb() {
  return {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([testItem]),
        onConflictDoUpdate: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ progressPercent: 50, completedAt: null }]),
        }),
      }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        leftJoin: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
          limit: vi.fn().mockResolvedValue([{ id: 'db-uuid-1', role: 'user', tier: 'free' }]),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([testItem]),
        }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([testItem]),
      }),
    }),
  }
}

function setupDbUser(mockDb: any, role: string = 'user') {
  mockDb.select.mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([{ id: 'db-uuid-1', role, tier: 'free' }]),
      }),
    }),
  })
}

beforeEach(async () => {
  mockFirebaseAuth.verifyIdToken.mockReset()
  mockFirebaseAuth.verifyIdToken.mockResolvedValue({
    uid: 'firebase-uid-123',
    email: 'test@example.com',
    role: 'user',
    tier: 'free',
  })

  app = await createTestApp()
  const mockDb = makeMockDb()
  app.decorate('db', mockDb)
  await app.register(contentRoutes, { prefix: '/v1/content' })
  await app.ready()
})

afterEach(async () => {
  await app.close()
})

// ─── GET /v1/content ─────────────────────────────────────────────────────────

describe('GET /v1/content', () => {
  it('returns 200 with paginated content list', async () => {
    const db = (app as any).db
    setupDbUser(db)
    // listContent query
    db.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        leftJoin: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi
                  .fn()
                  .mockResolvedValue([
                    { content_items: testItem, bookmarks: null, user_content_progress: null },
                  ]),
              }),
            }),
          }),
        }),
      }),
    })

    const res = await app.inject({
      method: 'GET',
      url: '/v1/content',
      headers: { authorization: 'Bearer valid-token' },
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.success).toBe(true)
    expect(body.data).toBeInstanceOf(Array)
  })

  it('returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/content',
    })
    expect(res.statusCode).toBe(401)
  })
})

// ─── GET /v1/content/:slug ───────────────────────────────────────────────────

describe('GET /v1/content/:slug', () => {
  it('returns 200 with content detail', async () => {
    const db = (app as any).db
    setupDbUser(db)
    db.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        leftJoin: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi
                .fn()
                .mockResolvedValue([
                  { content_items: testItem, bookmarks: null, user_content_progress: null },
                ]),
            }),
          }),
        }),
      }),
    })

    const res = await app.inject({
      method: 'GET',
      url: `/v1/content/${testItem.slug}`,
      headers: { authorization: 'Bearer valid-token' },
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.success).toBe(true)
    expect(body.data.slug).toBe(testItem.slug)
  })
})

// ─── Deprecation headers on admin routes ────────────────────────────────────

describe('Deprecation headers', () => {
  it('POST /v1/content includes deprecation headers', async () => {
    const db = (app as any).db
    setupDbUser(db, 'admin')
    db.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([testItem]),
      }),
    })

    const res = await app.inject({
      method: 'POST',
      url: '/v1/content',
      headers: { authorization: 'Bearer valid-token' },
      payload: {
        title: 'Test',
        slug: 'test',
        body: 'Body',
        category: 'safety',
        diagnosisStages: ['early'],
      },
    })

    expect(res.headers['deprecation']).toBe('true')
    expect(res.headers['sunset']).toBe('2026-06-30')
    expect(res.headers['link']).toContain('rel="deprecation"')
    expect(res.headers['link']).toContain('https://panel.haloapp.tech/admin')
  })

  it('DELETE /v1/content/:id includes deprecation headers', async () => {
    const db = (app as any).db
    setupDbUser(db, 'admin')

    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/content/${testItem.id}`,
      headers: { authorization: 'Bearer valid-token' },
    })

    expect(res.headers['deprecation']).toBe('true')
    expect(res.headers['sunset']).toBe('2026-06-30')
    expect(res.headers['link']).toContain('rel="deprecation"')
  })
})

// ─── POST /v1/content (admin only) ──────────────────────────────────────────

describe('POST /v1/content', () => {
  it('returns 201 for admin user', async () => {
    const db = (app as any).db
    setupDbUser(db, 'admin')
    db.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([testItem]),
      }),
    })

    const res = await app.inject({
      method: 'POST',
      url: '/v1/content',
      headers: { authorization: 'Bearer valid-token' },
      payload: {
        title: 'Test Article',
        slug: 'test-article',
        body: 'Content body here',
        category: 'safety',
        diagnosisStages: ['early'],
      },
    })

    expect(res.statusCode).toBe(201)
    const body = JSON.parse(res.body)
    expect(body.success).toBe(true)
  })

  it('returns 403 for regular user', async () => {
    const db = (app as any).db
    setupDbUser(db, 'user')

    const res = await app.inject({
      method: 'POST',
      url: '/v1/content',
      headers: { authorization: 'Bearer valid-token' },
      payload: {
        title: 'Test Article',
        slug: 'test-article',
        body: 'Content body here',
        category: 'safety',
        diagnosisStages: ['early'],
      },
    })

    expect(res.statusCode).toBe(403)
  })
})

// ─── DELETE /v1/content/:id (admin only) ─────────────────────────────────────

describe('DELETE /v1/content/:id', () => {
  it('returns 204 for admin user', async () => {
    const db = (app as any).db
    setupDbUser(db, 'admin')

    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/content/${testItem.id}`,
      headers: { authorization: 'Bearer valid-token' },
    })

    expect(res.statusCode).toBe(204)
  })

  it('returns 403 for regular user', async () => {
    const db = (app as any).db
    setupDbUser(db, 'user')

    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/content/${testItem.id}`,
      headers: { authorization: 'Bearer valid-token' },
    })

    expect(res.statusCode).toBe(403)
  })
})

// ─── POST /v1/content/:id/bookmark ───────────────────────────────────────────

describe('POST /v1/content/:id/bookmark', () => {
  it('returns 200 with bookmark toggle result', async () => {
    const db = (app as any).db
    setupDbUser(db)
    // toggleBookmark: INSERT ON CONFLICT DO NOTHING returns row — new bookmark
    const bookmark = createBookmarkFactory()
    db.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([bookmark]),
        }),
      }),
    })

    const res = await app.inject({
      method: 'POST',
      url: `/v1/content/${testItem.id}/bookmark`,
      headers: { authorization: 'Bearer valid-token' },
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.success).toBe(true)
    expect(typeof body.data.bookmarked).toBe('boolean')
  })
})

// ─── PUT /v1/content/:id/progress ────────────────────────────────────────────

describe('PUT /v1/content/:id/progress', () => {
  it('returns 200 with updated progress', async () => {
    const db = (app as any).db
    setupDbUser(db)

    const res = await app.inject({
      method: 'PUT',
      url: `/v1/content/${testItem.id}/progress`,
      headers: { authorization: 'Bearer valid-token' },
      payload: { progressPercent: 50 },
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.success).toBe(true)
  })

  it('rejects progress above 100', async () => {
    const db = (app as any).db
    setupDbUser(db)

    const res = await app.inject({
      method: 'PUT',
      url: `/v1/content/${testItem.id}/progress`,
      headers: { authorization: 'Bearer valid-token' },
      payload: { progressPercent: 150 },
    })

    expect(res.statusCode).toBe(400)
  })
})

// ─── GET /v1/content/bookmarks ───────────────────────────────────────────────

describe('GET /v1/content/bookmarks', () => {
  it('returns 200 with bookmarked items', async () => {
    const db = (app as any).db
    setupDbUser(db)
    db.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
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

    const res = await app.inject({
      method: 'GET',
      url: '/v1/content/bookmarks',
      headers: { authorization: 'Bearer valid-token' },
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.success).toBe(true)
    expect(body.data).toBeInstanceOf(Array)
  })
})
