/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { mockFirebaseAuth } from '../../../test/mocks/index.js'
import { createConversationFactory, createAiMessageFactory } from '../../../test/factories/index.js'

// Mock firebase
vi.mock('../../../lib/firebase-admin.js', () => ({
  firebaseAuth: mockFirebaseAuth,
}))

// Mock encryption
vi.mock('../../../lib/encryption.js', () => ({
  encryption: {
    encryptField: vi.fn((text: string) => Promise.resolve(`enc:${text}`)),
    decryptField: vi.fn((text: string) =>
      Promise.resolve(text.startsWith('enc:') ? text.slice(4) : text),
    ),
  },
}))

// Mock Sentry (used by error handler)
vi.mock('../../../lib/sentry.js', () => ({
  Sentry: { captureException: vi.fn() },
}))

const { createTestApp } = await import('../../../test/helpers.js')
const aiChatRoutes = (await import('../ai-chat.routes.js')).default

let app: FastifyInstance

const testConv = createConversationFactory({ userId: 'db-uuid-1' })
const testMsg = createAiMessageFactory({
  conversationId: testConv.id,
  role: 'assistant',
  content: 'enc:Hello',
})

// Reusable mock DB
function makeMockDb() {
  return {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([testConv]),
      }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([testConv]),
          }),
          limit: vi.fn().mockResolvedValue([testConv]),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([testMsg]),
        }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  }
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
  // Decorate with mock DB so requireDbUser passes
  app.decorate('db', mockDb)

  // Need to mock DB user lookup in verifyAuth
  const dbSelectChain = {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([{ id: 'db-uuid-1', role: 'user', tier: 'free' }]),
      }),
    }),
  }
  mockDb.select.mockReturnValue(dbSelectChain)

  await app.register(aiChatRoutes, { prefix: '/v1/ai' })
  await app.ready()
})

afterEach(async () => {
  await app.close()
})

describe('POST /v1/ai/conversations', () => {
  it('returns 201 with new conversation', async () => {
    const db = app.server.db ?? (app as any).db
    db.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([testConv]),
      }),
    })
    // Keep select for verifyAuth DB lookup
    db.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 'db-uuid-1', role: 'user', tier: 'free' }]),
        }),
      }),
    })

    const res = await app.inject({
      method: 'POST',
      url: '/v1/ai/conversations',
      headers: { authorization: 'Bearer valid-token' },
      payload: { title: 'Test Chat' },
    })

    expect(res.statusCode).toBe(201)
    const body = JSON.parse(res.body)
    expect(body.success).toBe(true)
    expect(body.data.id).toBeDefined()
  })

  it('returns 401 without auth header', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/ai/conversations',
      payload: {},
    })

    expect(res.statusCode).toBe(401)
  })
})

describe('GET /v1/ai/conversations', () => {
  it('returns 200 with conversation list', async () => {
    const db = (app as any).db
    // First call: verifyAuth DB user lookup
    db.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 'db-uuid-1', role: 'user', tier: 'free' }]),
        }),
      }),
    })
    // Second call: listConversations
    db.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([testConv]),
          }),
        }),
      }),
    })

    const res = await app.inject({
      method: 'GET',
      url: '/v1/ai/conversations',
      headers: { authorization: 'Bearer valid-token' },
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.success).toBe(true)
    expect(body.data).toBeInstanceOf(Array)
  })
})

describe('DELETE /v1/ai/conversations/:id', () => {
  it('returns 204 for owned conversation', async () => {
    const db = (app as any).db
    // verifyAuth
    db.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 'db-uuid-1', role: 'user', tier: 'free' }]),
        }),
      }),
    })
    // getConversation
    db.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([testConv]),
        }),
      }),
    })
    db.delete.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) })

    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/ai/conversations/${testConv.id}`,
      headers: { authorization: 'Bearer valid-token' },
    })

    expect(res.statusCode).toBe(204)
  })

  it('returns 404 for non-existent conversation', async () => {
    const db = (app as any).db
    // verifyAuth
    db.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 'db-uuid-1', role: 'user', tier: 'free' }]),
        }),
      }),
    })
    // getConversation returns empty
    db.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    })

    const res = await app.inject({
      method: 'DELETE',
      url: '/v1/ai/conversations/00000000-0000-0000-0000-000000000000',
      headers: { authorization: 'Bearer valid-token' },
    })

    expect(res.statusCode).toBe(404)
  })
})
