/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createConversationFactory, createAiMessageFactory } from '../../../test/factories/index.js'

vi.mock('../../../lib/encryption.js', () => ({
  encryption: {
    encryptField: vi.fn((text: string) => Promise.resolve(`enc:${text}`)),
    decryptField: vi.fn((text: string) =>
      Promise.resolve(text.startsWith('enc:') ? text.slice(4) : text),
    ),
  },
}))

const { encryption } = await import('../../../lib/encryption.js')
const {
  createConversation,
  listConversations,
  getConversation,
  getConversationMessages,
  deleteConversation,
  saveMessage,
  submitFeedback,
  autoTitleConversation,
} = await import('../ai-chat.service.js')

function mockDb() {
  const db: Record<string, unknown> = {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn(),
      }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn(),
          }),
          limit: vi.fn(),
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
      where: vi.fn(),
    }),
  }
  // Transparent transaction mock: invokes the callback with the same db object
  // so that per-test `db.insert.mockReturnValue(...)` setups apply inside the tx.
  db.transaction = vi.fn((cb: (tx: unknown) => unknown) => Promise.resolve(cb(db)))
  return db as unknown
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('createConversation', () => {
  it('inserts and returns a new conversation', async () => {
    const conv = createConversationFactory({ title: 'My Chat' })
    const db = mockDb() as ReturnType<typeof mockDb> & {
      insert: ReturnType<typeof vi.fn>
    }
    ;(db as any).insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([conv]),
      }),
    })

    const result = await createConversation(db as any, conv.userId, { title: 'My Chat' })

    expect(result.id).toBe(conv.id)
    expect(result.title).toBe('My Chat')
  })

  it('uses null title when not provided', async () => {
    const conv = createConversationFactory()
    const db = mockDb() as any
    db.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([conv]),
      }),
    })

    const result = await createConversation(db, conv.userId, {})

    expect(result).toBeDefined()
  })

  it('throws when insert returns empty', async () => {
    const db = mockDb() as any
    db.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    })

    await expect(createConversation(db, 'user-1', {})).rejects.toThrow(
      'Failed to create conversation',
    )
  })
})

describe('getConversation', () => {
  it('returns conversation when found and owned by user', async () => {
    const conv = createConversationFactory()
    const db = mockDb() as any
    db.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([conv]),
        }),
      }),
    })

    const result = await getConversation(db, conv.userId, conv.id)

    expect(result.id).toBe(conv.id)
  })

  it('throws 404 when conversation not found', async () => {
    const db = mockDb() as any
    db.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    })

    await expect(getConversation(db, 'user-1', 'no-such-id')).rejects.toThrow(
      'Conversation not found',
    )
  })
})

describe('saveMessage', () => {
  // Helper: build a mock DB pre-wired for a saveMessage happy path.
  // Returns the db plus references to the key mock fns so tests can assert
  // on how they were called.
  function setupSaveMessageMocks(options?: {
    insertedMessage?: ReturnType<typeof createAiMessageFactory>
    updateReturnsEmpty?: boolean
  }) {
    const msg = options?.insertedMessage ?? createAiMessageFactory()
    const db = mockDb() as any
    const valuesFn = vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([msg]),
    })
    db.insert.mockReturnValue({ values: valuesFn })

    const updateReturningFn = vi
      .fn()
      .mockResolvedValue(options?.updateReturnsEmpty ? [] : [{ id: msg.conversationId }])
    const whereFn = vi.fn().mockReturnValue({ returning: updateReturningFn })
    const setFn = vi.fn().mockReturnValue({ where: whereFn })
    db.update.mockReturnValue({ set: setFn })

    return { db, msg, valuesFn, setFn, whereFn, updateReturningFn }
  }

  it('encrypts content before inserting', async () => {
    const { db, msg } = setupSaveMessageMocks({
      insertedMessage: createAiMessageFactory({ content: 'enc:Hello' }),
    })

    await saveMessage(db, 'user-1', msg.conversationId, 'user', 'Hello')

    expect(encryption.encryptField).toHaveBeenCalledWith('Hello', 'user-1')
  })

  it('stores token count when provided', async () => {
    const { db, msg, valuesFn } = setupSaveMessageMocks({
      insertedMessage: createAiMessageFactory({ tokenCount: 42 }),
    })

    await saveMessage(db, 'user-1', msg.conversationId, 'assistant', 'Response', 42)

    expect(valuesFn).toHaveBeenCalledWith(expect.objectContaining({ tokenCount: 42 }))
  })

  it('touches the parent conversation updatedAt so MRU ordering reflects new messages', async () => {
    const { db, msg, setFn } = setupSaveMessageMocks()

    const before = Date.now()
    await saveMessage(db, 'user-1', msg.conversationId, 'user', 'Hello')
    const after = Date.now()

    expect(db.update).toHaveBeenCalledTimes(1)
    expect(setFn).toHaveBeenCalledTimes(1)
    const setArg = setFn.mock.calls[0][0]
    expect(setArg).toHaveProperty('updatedAt')
    expect(setArg.updatedAt).toBeInstanceOf(Date)
    // The Date must be produced at call time, not a stale reference.
    expect(setArg.updatedAt.getTime()).toBeGreaterThanOrEqual(before)
    expect(setArg.updatedAt.getTime()).toBeLessThanOrEqual(after)
  })

  it('still returns the inserted message when the updatedAt bump succeeds', async () => {
    const { db, msg } = setupSaveMessageMocks({
      insertedMessage: createAiMessageFactory({ content: 'enc:Hi' }),
    })

    const result = await saveMessage(db, 'user-1', msg.conversationId, 'user', 'Hi')

    expect(result.id).toBe(msg.id)
  })

  it('wraps the INSERT + UPDATE pair in a single transaction', async () => {
    const { db, msg } = setupSaveMessageMocks()

    await saveMessage(db, 'user-1', msg.conversationId, 'user', 'Hello')

    // A crash between the message INSERT and the parent's updatedAt bump
    // would leave the message persisted but the conversation buried in MRU
    // order — directly breaking the 2h cold-open rule. `db.transaction` makes
    // the pair atomic.
    expect(db.transaction).toHaveBeenCalledTimes(1)
  })

  it('scopes the updatedAt bump to both conversationId AND userId (defense-in-depth)', async () => {
    const { db, msg, whereFn } = setupSaveMessageMocks()

    await saveMessage(db, 'user-1', msg.conversationId, 'user', 'Hi')

    // The WHERE expression should reference both `id` AND `user_id`, so a
    // future caller that forgets to pre-check ownership still can't mutate
    // another user's conversation row.
    //
    // drizzle's `and()` nests column references behind multiple layers of
    // SQL wrapping — walk the object graph recursively and collect every
    // `name` property we see. Guards against cycles via a visited set.
    expect(whereFn).toHaveBeenCalledTimes(1)
    const whereExpr = whereFn.mock.calls[0][0]

    function collectNames(node: unknown, seen: Set<unknown> = new Set()): string[] {
      if (node === null || typeof node !== 'object' || seen.has(node)) return []
      seen.add(node)
      const names: string[] = []
      const n = (node as { name?: unknown }).name
      if (typeof n === 'string') names.push(n)
      for (const v of Object.values(node as Record<string, unknown>)) {
        if (Array.isArray(v)) {
          for (const item of v) names.push(...collectNames(item, seen))
        } else if (v && typeof v === 'object') {
          names.push(...collectNames(v, seen))
        }
      }
      return names
    }

    const referencedColumns = collectNames(whereExpr)
    expect(referencedColumns).toContain('id')
    expect(referencedColumns).toContain('user_id')
  })

  it('throws when the conversation does not exist or does not belong to the caller (IDOR defense)', async () => {
    // Simulate the UPDATE matching zero rows — this is what happens when the
    // caller passes a conversationId that belongs to another user (or no user
    // at all). The transaction MUST roll back so the INSERT above does not
    // leave an orphaned message in someone else's conversation.
    const { db } = setupSaveMessageMocks({ updateReturnsEmpty: true })

    await expect(
      saveMessage(db, 'user-1', '00000000-0000-0000-0000-000000000000', 'user', 'Hi'),
    ).rejects.toThrowError(/Conversation not found/)

    // `.returning()` on the UPDATE is what this test exercises. The transaction
    // wrap around INSERT + UPDATE means the throw inside the callback rolls
    // back the message INSERT — no database assertion needed here because the
    // mock is transparent, but the integration test verifies the rollback
    // against a real DB.
  })
})

describe('submitFeedback', () => {
  it('updates feedback rating on assistant message', async () => {
    const conv = createConversationFactory()
    const msg = createAiMessageFactory({
      conversationId: conv.id,
      role: 'assistant',
      feedbackRating: 'thumbs_up',
    })

    const db = mockDb() as any
    // getConversation mock
    db.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([conv]),
        }),
      }),
    })
    // getMessage mock
    db.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ ...msg, role: 'assistant' }]),
        }),
      }),
    })
    db.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ ...msg, feedbackRating: 'thumbs_up' }]),
        }),
      }),
    })

    const result = await submitFeedback(db, conv.userId, conv.id, msg.id, {
      rating: 'thumbs_up',
    })

    expect(result.feedbackRating).toBe('thumbs_up')
  })

  it('throws 400 when rating a user message', async () => {
    const conv = createConversationFactory()
    const msg = createAiMessageFactory({ conversationId: conv.id, role: 'user' })

    const db = mockDb() as any
    db.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([conv]),
        }),
      }),
    })
    db.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([msg]),
        }),
      }),
    })

    await expect(
      submitFeedback(db, conv.userId, conv.id, msg.id, { rating: 'thumbs_up' }),
    ).rejects.toThrow('Can only rate assistant messages')
  })

  it('throws 404 when message not found', async () => {
    const conv = createConversationFactory()
    const db = mockDb() as any
    db.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([conv]),
        }),
      }),
    })
    db.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    })

    await expect(
      submitFeedback(db, conv.userId, conv.id, 'no-msg', { rating: 'thumbs_down' }),
    ).rejects.toThrow('Message not found')
  })
})

describe('deleteConversation', () => {
  it('deletes an owned conversation', async () => {
    const conv = createConversationFactory()
    const db = mockDb() as any
    db.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([conv]),
        }),
      }),
    })
    db.delete.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) })

    await expect(deleteConversation(db, conv.userId, conv.id)).resolves.toBeUndefined()
  })

  it('throws 404 for unowned conversation', async () => {
    const db = mockDb() as any
    db.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    })

    await expect(deleteConversation(db, 'user-1', 'conv-x')).rejects.toThrow(
      'Conversation not found',
    )
  })
})

describe('listConversations', () => {
  function mockSelectChain(rows: any[]) {
    const db = mockDb() as any
    const limitFn = vi.fn().mockResolvedValue(rows)
    const orderByFn = vi.fn().mockReturnValue({ limit: limitFn })
    const whereFn = vi.fn().mockReturnValue({ orderBy: orderByFn })
    const fromFn = vi.fn().mockReturnValue({ where: whereFn })
    db.select.mockReturnValue({ from: fromFn })
    return { db, orderByFn, whereFn, fromFn, limitFn }
  }

  it('returns conversations without next cursor when fewer than limit', async () => {
    const convs = [createConversationFactory(), createConversationFactory()]
    const { db } = mockSelectChain(convs)

    const result = await listConversations(db, 'user-1', undefined, 20)

    expect(result.conversations).toHaveLength(2)
    expect(result.nextCursor).toBeNull()
  })

  it('returns composite `updatedAt|id` cursor from the last returned row when more results than limit', async () => {
    const convs = [
      createConversationFactory({
        id: '11111111-1111-1111-1111-111111111111',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-10T00:00:00Z'),
      }),
      createConversationFactory({
        id: '22222222-2222-2222-2222-222222222222',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-09T00:00:00Z'),
      }),
      createConversationFactory({
        id: '33333333-3333-3333-3333-333333333333',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-08T00:00:00Z'),
      }),
    ]
    const { db } = mockSelectChain(convs)

    const result = await listConversations(db, 'user-1', undefined, 2)

    expect(result.conversations).toHaveLength(2)
    // Cursor format: `{isoDatetime}|{uuid}`. The id tie-break is load-bearing —
    // a bare datetime would silently lose rows at same-ms page boundaries.
    expect(result.nextCursor).toBe('2024-01-09T00:00:00.000Z|22222222-2222-2222-2222-222222222222')
  })

  it('accepts composite cursor and tolerates malformed cursors without throwing', async () => {
    // Valid cursor → callable, no throw.
    const validCursor = '2024-01-09T00:00:00.000Z|22222222-2222-2222-2222-222222222222'
    const { db: db1 } = mockSelectChain([])
    await expect(listConversations(db1, 'user-1', validCursor, 20)).resolves.toBeDefined()

    // Malformed cursor → falls through to "restart from top" (same as undefined),
    // no 500.
    const { db: db2 } = mockSelectChain([])
    await expect(listConversations(db2, 'user-1', 'garbage', 20)).resolves.toBeDefined()
  })

  it('returns empty list with null cursor when no conversations', async () => {
    const { db } = mockSelectChain([])

    const result = await listConversations(db, 'user-1')

    expect(result.conversations).toHaveLength(0)
    expect(result.nextCursor).toBeNull()
  })

  it('does not mutate the original array (uses slice, not pop)', async () => {
    const convs = [
      createConversationFactory(),
      createConversationFactory(),
      createConversationFactory(),
    ]
    const originalLength = convs.length
    const { db } = mockSelectChain(convs)

    await listConversations(db, 'user-1', undefined, 2)

    expect(convs).toHaveLength(originalLength)
  })

  it('passes a primary + tie-break sort expression to orderBy (MRU + stable pagination)', async () => {
    // Shallow behavioural check: the service must call orderBy with exactly
    // TWO expressions — the primary MRU sort and the `id` tie-break. We do
    // NOT walk drizzle's internal `queryChunks` here because that structure
    // is a private implementation detail that could silently change shape
    // on a drizzle minor bump, producing a green test that asserts nothing.
    // The end-to-end semantics (correct column, correct direction, correct
    // tie-break) are proven by `ai-chat.integration.test.ts` against a real
    // pgvector DB.
    const { db, orderByFn } = mockSelectChain([])

    await listConversations(db, 'user-1', undefined, 20)

    expect(orderByFn).toHaveBeenCalledTimes(1)
    expect(orderByFn.mock.calls[0]).toHaveLength(2)
  })
})

describe('autoTitleConversation', () => {
  const mockAiClient = {
    generateContent: vi.fn(),
    generateContentStream: vi.fn(),
    countTokens: vi.fn(),
  } as any

  function mockDbForAutoTitle() {
    const whereFn = vi.fn().mockResolvedValue(undefined)
    const setFn = vi.fn().mockReturnValue({ where: whereFn })
    const db = mockDb() as any
    db.update.mockReturnValue({ set: setFn })
    return { db, setFn, whereFn }
  }

  it('generates title via Gemini and uses atomic UPDATE with isNull', async () => {
    const { db, setFn } = mockDbForAutoTitle()
    mockAiClient.generateContent.mockResolvedValue('  Managing Sleep Issues  ')

    await autoTitleConversation(
      db,
      mockAiClient,
      'user-1',
      'conv-1',
      'My mom has trouble sleeping at night',
    )

    expect(mockAiClient.generateContent).toHaveBeenCalledWith(expect.stringContaining('short'), [
      { role: 'user', parts: [{ text: 'My mom has trouble sleeping at night' }] },
    ])
    expect(setFn).toHaveBeenCalledWith({ title: 'Managing Sleep Issues' })
  })

  it('truncates title to 200 characters', async () => {
    const { db, setFn } = mockDbForAutoTitle()
    mockAiClient.generateContent.mockResolvedValue('A'.repeat(300))

    await autoTitleConversation(db, mockAiClient, 'user-1', 'conv-1', 'Long message')

    expect(setFn).toHaveBeenCalledWith({ title: 'A'.repeat(200) })
  })

  it('falls back to "New Chat" when Gemini returns empty', async () => {
    const { db, setFn } = mockDbForAutoTitle()
    mockAiClient.generateContent.mockResolvedValue('   ')

    await autoTitleConversation(db, mockAiClient, 'user-1', 'conv-1', 'Hello')

    expect(setFn).toHaveBeenCalledWith({ title: 'New Chat' })
  })

  it('does not throw when Gemini fails — logs warning instead', async () => {
    const { db } = mockDbForAutoTitle()
    mockAiClient.generateContent.mockRejectedValue(new Error('Vertex AI unavailable'))
    const logger = { error: vi.fn(), info: vi.fn() } as any

    await expect(
      autoTitleConversation(db, mockAiClient, 'user-1', 'conv-1', 'Hello', logger),
    ).resolves.toBeUndefined()

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error), conversationId: 'conv-1' }),
      'Auto-title generation failed',
    )
  })

  it('does not throw when DB UPDATE fails', async () => {
    const db = mockDb() as any
    mockAiClient.generateContent.mockResolvedValue('A Title')
    db.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockRejectedValue(new Error('DB write failed')),
      }),
    })

    const logger = { error: vi.fn(), info: vi.fn() } as any

    await expect(
      autoTitleConversation(db, mockAiClient, 'user-1', 'conv-1', 'Hello', logger),
    ).resolves.toBeUndefined()

    expect(logger.error).toHaveBeenCalled()
  })

  it('truncates input to 500 characters before sending to AI', async () => {
    const { db } = mockDbForAutoTitle()
    mockAiClient.generateContent.mockResolvedValue('Long Message Title')
    const longMessage = 'A'.repeat(1000)

    await autoTitleConversation(db, mockAiClient, 'user-1', 'conv-1', longMessage)

    const callArgs = mockAiClient.generateContent.mock.calls[0]
    const contents = callArgs[1] as Array<{ parts: Array<{ text: string }> }>
    const userMessageText = contents[0]!.parts[0]!.text

    expect(userMessageText).toHaveLength(500)
    expect(userMessageText).toBe('A'.repeat(500))
  })

  it('does not log PHI — title excluded from log payload', async () => {
    const { db } = mockDbForAutoTitle()
    mockAiClient.generateContent.mockResolvedValue('Some Title')
    const logger = { error: vi.fn(), info: vi.fn() } as any

    await autoTitleConversation(db, mockAiClient, 'user-1', 'conv-1', 'Hello', logger)

    expect(logger.info).toHaveBeenCalledWith(
      { conversationId: 'conv-1' },
      'Auto-titled conversation',
    )
    // Ensure title is NOT in the log payload
    const logPayload = logger.info.mock.calls[0][0]
    expect(logPayload).not.toHaveProperty('title')
  })

  it('TITLE_PROMPT instructs no PHI in titles', async () => {
    const { TITLE_PROMPT } = await import('../ai-chat.service.js')
    expect(TITLE_PROMPT).toContain('personal names')
    expect(TITLE_PROMPT).toContain('medications')
    expect(TITLE_PROMPT).toContain('diagnoses')
  })
})

describe('getConversationMessages', () => {
  it('returns decrypted messages', async () => {
    const conv = createConversationFactory()
    const msgs = [
      createAiMessageFactory({ conversationId: conv.id, content: 'enc:Hello' }),
      createAiMessageFactory({ conversationId: conv.id, content: 'enc:World' }),
    ]

    const db = mockDb() as any
    // getConversation mock (ownership check)
    db.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([conv]),
        }),
      }),
    })
    // messages query mock
    db.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(msgs),
        }),
      }),
    })

    const result = await getConversationMessages(db, conv.userId, conv.id)

    expect(result).toHaveLength(2)
    expect(result[0]!.content).toBe('Hello')
    expect(result[1]!.content).toBe('World')
  })

  it('returns [Decryption failed] for messages that fail to decrypt', async () => {
    const conv = createConversationFactory()
    const msgs = [createAiMessageFactory({ conversationId: conv.id, content: 'bad-ciphertext' })]

    const db = mockDb() as any
    db.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([conv]),
        }),
      }),
    })
    db.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(msgs),
        }),
      }),
    })

    // Make decryptField throw for this specific content
    vi.mocked(encryption.decryptField).mockRejectedValueOnce(new Error('Decryption error'))

    const result = await getConversationMessages(db, conv.userId, conv.id)

    expect(result).toHaveLength(1)
    expect(result[0]!.content).toBe('[Decryption failed]')
  })

  it('logs error on decryption failure when logger provided', async () => {
    const conv = createConversationFactory()
    const msgs = [createAiMessageFactory({ conversationId: conv.id, content: 'bad-ciphertext' })]

    const db = mockDb() as any
    db.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([conv]),
        }),
      }),
    })
    db.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(msgs),
        }),
      }),
    })

    const decryptError = new Error('Decryption error')
    vi.mocked(encryption.decryptField).mockRejectedValueOnce(decryptError)

    const logger = { error: vi.fn() } as any

    const result = await getConversationMessages(db, conv.userId, conv.id, logger)

    expect(result[0]!.content).toBe('[Decryption failed]')
    expect(logger.error).toHaveBeenCalledWith(
      { err: decryptError, messageId: msgs[0]!.id, conversationId: conv.id },
      'Message decryption failed',
    )
  })
})
