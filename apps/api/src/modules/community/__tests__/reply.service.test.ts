import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../lib/sanitize.js', () => ({
  sanitizeContent: vi.fn((s: string) => s),
}))

import { listReplies, createReply, deleteReply } from '../reply.service.js'

// ─── Mock DB Builder ────────────────────────────────────────────────────────

function buildSimpleSelectChain(rows: unknown[] = []) {
  return vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  })
}

function buildInsertChain(rows: unknown[] = []) {
  return vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue(rows),
    }),
  })
}

function buildUpdateChain() {
  return vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  })
}

const now = new Date('2026-03-28T12:00:00.000Z')

function makeReplyRow(id: string, authorId: string, postId: string) {
  return {
    community_replies: {
      id,
      body: `Reply body ${id}`,
      likeCount: 1,
      postId,
      authorId,
      status: 'active',
      createdAt: now,
    },
    users: {
      id: authorId,
      displayName: 'Test User',
      caregiverRelationship: 'spouse',
    },
  }
}

// ─── listReplies ────────────────────────────────────────────────────────────

describe('listReplies', () => {
  const postId = 'post-1'
  const userId = 'user-1'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty items when no replies exist', async () => {
    let callCount = 0
    const db = {
      select: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          // join select for replies
          return {
            from: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([]),
                  }),
                }),
              }),
            }),
          }
        }
        // liked ids query (should not be called since replyIds is empty)
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }
      }),
    } as never

    const result = await listReplies(db, postId, userId, {})

    expect(result).toEqual({ items: [], nextCursor: null })
  })

  it('returns paginated replies with nextCursor', async () => {
    const rows = [
      makeReplyRow('r1', 'author-1', postId),
      makeReplyRow('r2', 'author-2', postId),
      // 3rd row triggers hasMore (limit=2, rows.length=3)
      makeReplyRow('r3', 'author-3', postId),
    ]

    let callCount = 0
    const db = {
      select: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return {
            from: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue(rows),
                  }),
                }),
              }),
            }),
          }
        }
        // liked reply ids
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ replyId: 'r1' }]),
          }),
        }
      }),
    } as never

    const result = await listReplies(db, postId, userId, { limit: 2 })

    expect(result.items).toHaveLength(2)
    expect(result.items[0]!.id).toBe('r1')
    expect(result.items[0]!.isLikedByMe).toBe(true)
    expect(result.items[1]!.isLikedByMe).toBe(false)
    expect(result.nextCursor).toContain('|r2')
  })

  it('parses cursor for pagination', async () => {
    let callCount = 0
    const db = {
      select: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return {
            from: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([]),
                  }),
                }),
              }),
            }),
          }
        }
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }
      }),
    } as never

    const result = await listReplies(db, postId, userId, {
      cursor: '2026-03-28T10:00:00.000Z|some-id',
    })

    expect(result.items).toEqual([])
    expect(result.nextCursor).toBeNull()
  })

  it('returns null nextCursor when no more results', async () => {
    const rows = [makeReplyRow('r1', 'author-1', postId)]

    let callCount = 0
    const db = {
      select: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return {
            from: vi.fn().mockReturnValue({
              innerJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue(rows),
                  }),
                }),
              }),
            }),
          }
        }
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }
      }),
    } as never

    const result = await listReplies(db, postId, userId, { limit: 20 })

    expect(result.items).toHaveLength(1)
    expect(result.nextCursor).toBeNull()
  })

  it('defaults limit to 20', async () => {
    let capturedLimit: number | undefined
    const db = {
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockImplementation((l: number) => {
                  capturedLimit = l
                  return Promise.resolve([])
                }),
              }),
            }),
          }),
        }),
      })),
    } as never

    await listReplies(db, postId, userId, {})

    // limit + 1 = 21
    expect(capturedLimit).toBe(21)
  })
})

// ─── createReply ────────────────────────────────────────────────────────────

describe('createReply', () => {
  const postId = 'post-1'
  const userId = 'user-1'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a reply and increments reply count', async () => {
    const mockTx = {
      insert: buildInsertChain([{ id: 'new-reply' }]),
      update: buildUpdateChain(),
    }

    const db = {
      select: buildSimpleSelectChain([{ id: postId }]),
      transaction: vi.fn().mockImplementation(async (fn) => fn(mockTx)),
    } as never

    const result = await createReply(db, postId, userId, 'Nice post!')

    expect(result).toEqual({ id: 'new-reply' })
  })

  it('throws 404 when post not found', async () => {
    const db = {
      select: buildSimpleSelectChain([]),
      transaction: vi.fn(),
    } as never

    await expect(createReply(db, postId, userId, 'Text')).rejects.toMatchObject({
      message: 'Post not found',
      statusCode: 404,
    })
  })

  it('throws when insert fails to return a row', async () => {
    const mockTx = {
      insert: buildInsertChain([]),
      update: buildUpdateChain(),
    }

    const db = {
      select: buildSimpleSelectChain([{ id: postId }]),
      transaction: vi.fn().mockImplementation(async (fn) => fn(mockTx)),
    } as never

    await expect(createReply(db, postId, userId, 'Text')).rejects.toThrow('Failed to create reply')
  })

  it('sanitizes reply body', async () => {
    const { sanitizeContent } = await import('../../../lib/sanitize.js')

    const mockTx = {
      insert: buildInsertChain([{ id: 'r-new' }]),
      update: buildUpdateChain(),
    }

    const db = {
      select: buildSimpleSelectChain([{ id: postId }]),
      transaction: vi.fn().mockImplementation(async (fn) => fn(mockTx)),
    } as never

    await createReply(db, postId, userId, '<script>alert("xss")</script>')

    expect(sanitizeContent).toHaveBeenCalledWith('<script>alert("xss")</script>')
  })
})

// ─── deleteReply ────────────────────────────────────────────────────────────

describe('deleteReply', () => {
  const replyId = 'reply-1'
  const postId = 'post-1'
  const authorId = 'user-1'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('soft-deletes own reply', async () => {
    const mockTx = {
      update: buildUpdateChain(),
    }

    const db = {
      select: buildSimpleSelectChain([{ authorId, postId }]),
      transaction: vi.fn().mockImplementation(async (fn) => fn(mockTx)),
    } as never

    await expect(deleteReply(db, replyId, authorId, 'user')).resolves.toBeUndefined()
  })

  it('allows admin to delete any reply', async () => {
    const mockTx = {
      update: buildUpdateChain(),
    }

    const db = {
      select: buildSimpleSelectChain([{ authorId: 'other-user', postId }]),
      transaction: vi.fn().mockImplementation(async (fn) => fn(mockTx)),
    } as never

    await expect(deleteReply(db, replyId, 'admin-user', 'admin')).resolves.toBeUndefined()
  })

  it('allows moderator to delete any reply', async () => {
    const mockTx = {
      update: buildUpdateChain(),
    }

    const db = {
      select: buildSimpleSelectChain([{ authorId: 'other-user', postId }]),
      transaction: vi.fn().mockImplementation(async (fn) => fn(mockTx)),
    } as never

    await expect(deleteReply(db, replyId, 'mod-user', 'moderator')).resolves.toBeUndefined()
  })

  it('throws 404 when reply not found', async () => {
    const db = {
      select: buildSimpleSelectChain([]),
      transaction: vi.fn(),
    } as never

    await expect(deleteReply(db, replyId, authorId, 'user')).rejects.toMatchObject({
      message: 'Reply not found',
      statusCode: 404,
    })
  })

  it('throws 403 when non-owner non-admin tries to delete', async () => {
    const db = {
      select: buildSimpleSelectChain([{ authorId: 'someone-else', postId }]),
      transaction: vi.fn(),
    } as never

    await expect(deleteReply(db, replyId, 'intruder', 'user')).rejects.toMatchObject({
      message: 'Not authorized to delete this reply',
      statusCode: 403,
    })
  })
})
