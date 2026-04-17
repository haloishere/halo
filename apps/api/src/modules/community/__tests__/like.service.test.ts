import { describe, it, expect, vi, beforeEach } from 'vitest'
import { togglePostLike, toggleReplyLike } from '../like.service.js'

// ─── Mock DB Builder ────────────────────────────────────────────────────────

function createChain(result: unknown[] = []) {
  return vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({
      onConflictDoNothing: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue(result),
      }),
    }),
  })
}

function createSelectChain(rows: unknown[] = []) {
  return vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  })
}

function createUpdateChain(rows: unknown[] = []) {
  return vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue(rows),
      }),
    }),
  })
}

function createDeleteChain() {
  return vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  })
}

function buildMockTx(overrides: Record<string, unknown> = {}) {
  return {
    select: createSelectChain(),
    insert: createChain(),
    update: createUpdateChain(),
    delete: createDeleteChain(),
    ...overrides,
  }
}

function buildMockDb(tx: ReturnType<typeof buildMockTx>) {
  return {
    ...tx,
    transaction: vi.fn().mockImplementation(async (fn) => fn(tx)),
  } as never
}

// ─── togglePostLike ─────────────────────────────────────────────────────────

describe('togglePostLike', () => {
  const userId = 'user-1'
  const postId = 'post-1'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('likes a post when not yet liked (insert succeeds)', async () => {
    const tx = buildMockTx()
    // select: post exists
    tx.select = createSelectChain([{ id: postId, likeCount: 5 }])
    // insert: new like inserted
    tx.insert = createChain([{ userId, postId }])
    // update: returns incremented count
    tx.update = createUpdateChain([{ likeCount: 6 }])

    const db = buildMockDb(tx)
    const result = await togglePostLike(db, userId, postId)

    expect(result).toEqual({ liked: true, likeCount: 6 })
  })

  it('unlikes a post when already liked (insert returns empty)', async () => {
    const tx = buildMockTx()
    tx.select = createSelectChain([{ id: postId, likeCount: 5 }])
    // insert: conflict, no rows returned
    tx.insert = createChain([])
    // update: returns decremented count
    tx.update = createUpdateChain([{ likeCount: 4 }])

    const db = buildMockDb(tx)
    const result = await togglePostLike(db, userId, postId)

    expect(result).toEqual({ liked: false, likeCount: 4 })
  })

  it('throws 404 when post not found', async () => {
    const tx = buildMockTx()
    tx.select = createSelectChain([])

    const db = buildMockDb(tx)

    await expect(togglePostLike(db, userId, postId)).rejects.toMatchObject({
      message: 'Post not found',
      statusCode: 404,
    })
  })

  it('uses fallback likeCount when update returns undefined (like path)', async () => {
    const tx = buildMockTx()
    tx.select = createSelectChain([{ id: postId, likeCount: 3 }])
    tx.insert = createChain([{ userId, postId }])
    // update returns empty array (no row returned)
    tx.update = createUpdateChain([])

    const db = buildMockDb(tx)
    const result = await togglePostLike(db, userId, postId)

    expect(result).toEqual({ liked: true, likeCount: 4 })
  })

  it('uses fallback likeCount when update returns undefined (unlike path)', async () => {
    const tx = buildMockTx()
    tx.select = createSelectChain([{ id: postId, likeCount: 2 }])
    tx.insert = createChain([])
    tx.update = createUpdateChain([])

    const db = buildMockDb(tx)
    const result = await togglePostLike(db, userId, postId)

    expect(result).toEqual({ liked: false, likeCount: 1 })
  })

  it('clamps fallback likeCount to 0 on unlike', async () => {
    const tx = buildMockTx()
    tx.select = createSelectChain([{ id: postId, likeCount: 0 }])
    tx.insert = createChain([])
    tx.update = createUpdateChain([])

    const db = buildMockDb(tx)
    const result = await togglePostLike(db, userId, postId)

    expect(result).toEqual({ liked: false, likeCount: 0 })
  })

  it('logs when liking a post', async () => {
    const tx = buildMockTx()
    tx.select = createSelectChain([{ id: postId, likeCount: 0 }])
    tx.insert = createChain([{ userId, postId }])
    tx.update = createUpdateChain([{ likeCount: 1 }])

    const db = buildMockDb(tx)
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never
    await togglePostLike(db, userId, postId, logger)

    expect((logger as { info: ReturnType<typeof vi.fn> }).info).toHaveBeenCalledWith(
      { postId },
      'Post liked',
    )
  })

  it('logs when unliking a post', async () => {
    const tx = buildMockTx()
    tx.select = createSelectChain([{ id: postId, likeCount: 1 }])
    tx.insert = createChain([])
    tx.update = createUpdateChain([{ likeCount: 0 }])

    const db = buildMockDb(tx)
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never
    await togglePostLike(db, userId, postId, logger)

    expect((logger as { info: ReturnType<typeof vi.fn> }).info).toHaveBeenCalledWith(
      { postId },
      'Post unliked',
    )
  })
})

// ─── toggleReplyLike ────────────────────────────────────────────────────────

describe('toggleReplyLike', () => {
  const userId = 'user-1'
  const replyId = 'reply-1'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('likes a reply when not yet liked', async () => {
    const tx = buildMockTx()
    tx.select = createSelectChain([{ id: replyId, likeCount: 2 }])
    tx.insert = createChain([{ userId, replyId }])
    tx.update = createUpdateChain([{ likeCount: 3 }])

    const db = buildMockDb(tx)
    const result = await toggleReplyLike(db, userId, replyId)

    expect(result).toEqual({ liked: true, likeCount: 3 })
  })

  it('unlikes a reply when already liked', async () => {
    const tx = buildMockTx()
    tx.select = createSelectChain([{ id: replyId, likeCount: 2 }])
    tx.insert = createChain([])
    tx.update = createUpdateChain([{ likeCount: 1 }])

    const db = buildMockDb(tx)
    const result = await toggleReplyLike(db, userId, replyId)

    expect(result).toEqual({ liked: false, likeCount: 1 })
  })

  it('throws 404 when reply not found', async () => {
    const tx = buildMockTx()
    tx.select = createSelectChain([])

    const db = buildMockDb(tx)

    await expect(toggleReplyLike(db, userId, replyId)).rejects.toMatchObject({
      message: 'Reply not found',
      statusCode: 404,
    })
  })

  it('uses fallback likeCount when update returns undefined (like path)', async () => {
    const tx = buildMockTx()
    tx.select = createSelectChain([{ id: replyId, likeCount: 7 }])
    tx.insert = createChain([{ userId, replyId }])
    tx.update = createUpdateChain([])

    const db = buildMockDb(tx)
    const result = await toggleReplyLike(db, userId, replyId)

    expect(result).toEqual({ liked: true, likeCount: 8 })
  })

  it('uses fallback likeCount clamped to 0 on unlike', async () => {
    const tx = buildMockTx()
    tx.select = createSelectChain([{ id: replyId, likeCount: 0 }])
    tx.insert = createChain([])
    tx.update = createUpdateChain([])

    const db = buildMockDb(tx)
    const result = await toggleReplyLike(db, userId, replyId)

    expect(result).toEqual({ liked: false, likeCount: 0 })
  })

  it('logs when liking a reply', async () => {
    const tx = buildMockTx()
    tx.select = createSelectChain([{ id: replyId, likeCount: 0 }])
    tx.insert = createChain([{ userId, replyId }])
    tx.update = createUpdateChain([{ likeCount: 1 }])

    const db = buildMockDb(tx)
    const logger = { info: vi.fn() } as never
    await toggleReplyLike(db, userId, replyId, logger)

    expect((logger as { info: ReturnType<typeof vi.fn> }).info).toHaveBeenCalledWith(
      { replyId },
      'Reply liked',
    )
  })
})
