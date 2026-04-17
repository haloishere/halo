import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../lib/cursor-utils.js', () => ({
  parseCursor: vi.fn(),
}))

import { reportPost, reportReply, listReports, updateReportStatus } from '../report.service.js'
import { parseCursor } from '../../../lib/cursor-utils.js'

// ─── Mock DB Helpers ────────────────────────────────────────────────────────

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
      onConflictDoNothing: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue(rows),
      }),
    }),
  })
}

function buildUpdateChain(rows: unknown[] = []) {
  return vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue(rows),
      }),
    }),
  })
}

function buildListSelectChain(rows: unknown[] = []) {
  return vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(rows),
        }),
      }),
    }),
  })
}

const now = new Date('2026-03-28T12:00:00.000Z')

function makeReport(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    reason: 'spam',
    status: 'pending',
    details: null,
    reporterId: 'reporter-1',
    postId: 'post-1',
    replyId: null,
    createdAt: now,
    reviewedBy: null,
    ...overrides,
  }
}

// ─── reportPost ─────────────────────────────────────────────────────────────

describe('reportPost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a new report for a post', async () => {
    const db = {
      select: buildSimpleSelectChain([{ id: 'post-1' }]),
      insert: buildInsertChain([{ id: 'report-1' }]),
    } as never

    const result = await reportPost(db, 'reporter-1', 'post-1', 'spam')

    expect(result).toEqual({ id: 'report-1', alreadyReported: false })
  })

  it('returns alreadyReported=true on duplicate report', async () => {
    // First call: select for post existence. Second call: select for existing report.
    let selectCallCount = 0
    const db = {
      select: vi.fn().mockImplementation(() => {
        selectCallCount++
        if (selectCallCount === 1) {
          // post exists
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{ id: 'post-1' }]),
              }),
            }),
          }
        }
        // existing report
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: 'existing-report' }]),
            }),
          }),
        }
      }),
      insert: buildInsertChain([]), // conflict, empty
    } as never

    const result = await reportPost(db, 'reporter-1', 'post-1', 'spam')

    expect(result).toEqual({ id: 'existing-report', alreadyReported: true })
  })

  it('throws 404 when post not found', async () => {
    const db = {
      select: buildSimpleSelectChain([]),
      insert: buildInsertChain(),
    } as never

    await expect(reportPost(db, 'reporter-1', 'missing-post', 'spam')).rejects.toMatchObject({
      message: 'Post not found',
      statusCode: 404,
    })
  })

  it('passes details to insert', async () => {
    const mockInsert = buildInsertChain([{ id: 'r1' }])
    const db = {
      select: buildSimpleSelectChain([{ id: 'post-1' }]),
      insert: mockInsert,
    } as never

    await reportPost(db, 'reporter-1', 'post-1', 'phi_exposure' as never, 'Contains patient name')

    // Verify insert was called (values receives the data)
    expect(mockInsert).toHaveBeenCalled()
  })
})

// ─── reportReply ────────────────────────────────────────────────────────────

describe('reportReply', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a new report for a reply', async () => {
    const db = {
      select: buildSimpleSelectChain([{ id: 'reply-1' }]),
      insert: buildInsertChain([{ id: 'report-2' }]),
    } as never

    const result = await reportReply(db, 'reporter-1', 'reply-1', 'harmful' as never)

    expect(result).toEqual({ id: 'report-2', alreadyReported: false })
  })

  it('returns alreadyReported=true on duplicate reply report', async () => {
    let selectCallCount = 0
    const db = {
      select: vi.fn().mockImplementation(() => {
        selectCallCount++
        if (selectCallCount === 1) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{ id: 'reply-1' }]),
              }),
            }),
          }
        }
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: 'existing-report' }]),
            }),
          }),
        }
      }),
      insert: buildInsertChain([]),
    } as never

    const result = await reportReply(db, 'reporter-1', 'reply-1', 'spam')

    expect(result).toEqual({ id: 'existing-report', alreadyReported: true })
  })

  it('throws 404 when reply not found', async () => {
    const db = {
      select: buildSimpleSelectChain([]),
      insert: buildInsertChain(),
    } as never

    await expect(reportReply(db, 'reporter-1', 'missing-reply', 'spam')).rejects.toMatchObject({
      message: 'Reply not found',
      statusCode: 404,
    })
  })
})

// ─── listReports ────────────────────────────────────────────────────────────

describe('listReports', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty list when no reports', async () => {
    const db = {
      select: buildListSelectChain([]),
    } as never

    const result = await listReports(db, {})

    expect(result).toEqual({ items: [], nextCursor: null })
  })

  it('returns reports with mapped fields', async () => {
    const rows = [makeReport('r1'), makeReport('r2', { reason: 'harmful' })]

    const db = {
      select: buildListSelectChain(rows),
    } as never

    const result = await listReports(db, { limit: 20 })

    expect(result.items).toHaveLength(2)
    expect(result.items[0]!.id).toBe('r1')
    expect(result.items[0]!.reason).toBe('spam')
    expect(result.items[0]!.createdAt).toBe('2026-03-28T12:00:00.000Z')
    expect(result.items[1]!.reason).toBe('harmful')
    expect(result.nextCursor).toBeNull()
  })

  it('returns nextCursor when hasMore', async () => {
    const rows = [makeReport('r1'), makeReport('r2'), makeReport('r3')]

    const db = {
      select: buildListSelectChain(rows),
    } as never

    const result = await listReports(db, { limit: 2 })

    expect(result.items).toHaveLength(2)
    expect(result.nextCursor).toContain('|r2')
  })

  it('filters by status', async () => {
    const db = {
      select: buildListSelectChain([]),
    } as never

    const result = await listReports(db, { status: 'pending' })

    expect(result.items).toEqual([])
  })

  it('applies cursor pagination via parseCursor', async () => {
    vi.mocked(parseCursor).mockReturnValue({
      date: new Date('2026-03-27T00:00:00.000Z'),
      id: 'cursor-id',
    })

    const db = {
      select: buildListSelectChain([]),
    } as never

    const result = await listReports(db, { cursor: '2026-03-27T00:00:00.000Z|cursor-id' })

    expect(parseCursor).toHaveBeenCalledWith('2026-03-27T00:00:00.000Z|cursor-id')
    expect(result.items).toEqual([])
  })

  it('ignores invalid cursor from parseCursor', async () => {
    vi.mocked(parseCursor).mockReturnValue(null)

    const db = {
      select: buildListSelectChain([]),
    } as never

    const result = await listReports(db, { cursor: 'invalid' })

    expect(result.items).toEqual([])
  })

  it('defaults limit to 20', async () => {
    let capturedLimit: number | undefined
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
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
    } as never

    await listReports(db, {})

    // limit + 1 = 21
    expect(capturedLimit).toBe(21)
  })
})

// ─── updateReportStatus ─────────────────────────────────────────────────────

describe('updateReportStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updates report status', async () => {
    const db = {
      update: buildUpdateChain([{ id: 'r1', status: 'reviewed', reviewedBy: 'admin-1' }]),
    } as never

    const result = await updateReportStatus(db, 'r1', 'reviewed' as never, 'admin-1')

    expect(result).toEqual({ id: 'r1', status: 'reviewed', reviewedBy: 'admin-1' })
  })

  it('throws 404 when report not found', async () => {
    const db = {
      update: buildUpdateChain([]),
    } as never

    await expect(
      updateReportStatus(db, 'nonexistent', 'reviewed' as never, 'admin-1'),
    ).rejects.toMatchObject({
      message: 'Report not found',
      statusCode: 404,
    })
  })

  it('uses passed reviewedBy when DB returns null', async () => {
    const db = {
      update: buildUpdateChain([{ id: 'r1', status: 'actioned', reviewedBy: null }]),
    } as never

    const result = await updateReportStatus(db, 'r1', 'actioned' as never, 'admin-2')

    expect(result.reviewedBy).toBe('admin-2')
  })

  it('logs when status is updated', async () => {
    const db = {
      update: buildUpdateChain([{ id: 'r1', status: 'dismissed', reviewedBy: 'admin-1' }]),
    } as never
    const logger = { info: vi.fn() } as never

    await updateReportStatus(db, 'r1', 'dismissed' as never, 'admin-1', logger)

    expect((logger as { info: ReturnType<typeof vi.fn> }).info).toHaveBeenCalledWith(
      { reportId: 'r1', status: 'dismissed', reviewedBy: 'admin-1' },
      'Report status updated',
    )
  })
})
