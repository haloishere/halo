import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ────────────────────────────────────────────────────────────────────
// vi.hoisted ensures variables are initialized before the hoisted vi.mock factory runs.
const { mockSearch, mockWriteAuditLog } = vi.hoisted(() => ({
  mockSearch: vi.fn(),
  mockWriteAuditLog: vi.fn(),
}))

vi.mock('../daydream.client.js', () => ({ search: mockSearch }))
vi.mock('../../../lib/audit.js', () => ({ writeAuditLog: mockWriteAuditLog }))

import type { DaydreamProduct } from '@halo/shared'
import { searchDaydream } from '../daydream.service.js'

// ── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_DB = {} as never
const OPTS = {
  db: MOCK_DB,
  userId: 'user-abc',
  conversationId: 'conv-xyz',
}

function makeProduct(overrides: Partial<DaydreamProduct> = {}): DaydreamProduct {
  return {
    id: 'prod-1',
    brand: 'Acme',
    name: 'Chelsea Boot',
    description: 'Brown leather',
    priceCents: 15000,
    regularPriceCents: 20000,
    onSale: true,
    currency: 'USD',
    imageUrl: 'https://cdn.dahlialabs.dev/boot.jpg',
    sizesInStock: 3,
    sizesTotal: 5,
    shopUrl: 'https://shop.example.com/boot',
    ...overrides,
  }
}

beforeEach(() => {
  mockSearch.mockReset()
  mockWriteAuditLog.mockReset()
})

// ── Tests ────────────────────────────────────────────────────────────────────

describe('searchDaydream — happy path', () => {
  it('returns Zod-validated products from the client', async () => {
    const product = makeProduct()
    mockSearch.mockResolvedValueOnce({
      chatId: 'chat-1',
      messageId: 'msg-1',
      products: [product],
    })

    const results = await searchDaydream('chelsea boots', OPTS)
    expect(results).toHaveLength(1)
    expect(results[0]!.name).toBe('Chelsea Boot')
  })

  it('writes an ai.tool.call audit entry with outcome: ok', async () => {
    const product = makeProduct()
    mockSearch.mockResolvedValueOnce({
      chatId: 'chat-1',
      messageId: 'msg-1',
      products: [product],
    })

    await searchDaydream('chelsea boots', OPTS)

    expect(mockWriteAuditLog).toHaveBeenCalledOnce()
    const [, entry] = mockWriteAuditLog.mock.calls[0]!
    expect(entry.action).toBe('ai.tool.call')
    expect(entry.resource).toBe('daydream_search')
    expect(entry.userId).toBe('user-abc')
    expect(entry.resourceId).toBe('conv-xyz')
    expect(entry.metadata.outcome).toBe('ok')
    expect(entry.metadata.productsReturned).toBe(1)
    expect(typeof entry.metadata.queryHash).toBe('string')
    expect(entry.metadata.queryHash).toHaveLength(64) // SHA-256 hex
    expect(typeof entry.metadata.latencyMs).toBe('number')
  })

  it('filters out products that fail Zod schema validation', async () => {
    // A product with wrong currency is dropped.
    const invalid = { ...makeProduct(), currency: 'EUR' as 'USD' }
    const valid = makeProduct({ id: 'prod-2', name: 'Boot B' })
    mockSearch.mockResolvedValueOnce({
      chatId: 'c',
      messageId: 'm',
      products: [invalid, valid],
    })

    const results = await searchDaydream('boots', OPTS)
    expect(results).toHaveLength(1)
    expect(results[0]!.id).toBe('prod-2')
  })

  it('emits a warn log when products are dropped by Zod validation', async () => {
    const mockLogger = { warn: vi.fn(), error: vi.fn() }
    const invalid = { ...makeProduct(), currency: 'EUR' as 'USD' }
    const valid = makeProduct({ id: 'prod-2' })
    mockSearch.mockResolvedValueOnce({ chatId: 'c', messageId: 'm', products: [invalid, valid] })

    await searchDaydream('boots', { ...OPTS, logger: mockLogger as never })

    expect(mockLogger.warn).toHaveBeenCalledOnce()
    const [meta, msg] = mockLogger.warn.mock.calls[0]!
    expect((meta as { dropped: number }).dropped).toBe(1)
    expect(msg as string).toContain('schema validation failure')
  })
})

describe('searchDaydream — error path', () => {
  it('returns an empty array when the client throws an external service error', async () => {
    mockSearch.mockRejectedValueOnce(new Error('BFF send failed: 503'))
    const results = await searchDaydream('boots', OPTS)
    expect(results).toHaveLength(0)
  })

  it('re-throws infrastructure errors (non-external-service) so Sentry can capture them', async () => {
    mockSearch.mockRejectedValueOnce(new Error('DAYDREAM_JWT_SECRET_NAME env var required'))
    await expect(searchDaydream('boots', OPTS)).rejects.toThrow('DAYDREAM_JWT_SECRET_NAME')
  })

  it('writes an audit entry with outcome: error on external failure', async () => {
    mockSearch.mockRejectedValueOnce(new Error('BFF send failed: 503'))
    await searchDaydream('boots', OPTS)

    expect(mockWriteAuditLog).toHaveBeenCalledOnce()
    const [, entry] = mockWriteAuditLog.mock.calls[0]!
    expect(entry.metadata.outcome).toBe('error')
    expect(entry.metadata.productsReturned).toBe(0)
    expect(typeof entry.metadata.errorCode).toBe('string')
  })
})
