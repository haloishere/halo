import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────
const { mockSearchDaydream } = vi.hoisted(() => ({
  mockSearchDaydream: vi.fn(),
}))

vi.mock('../../daydream/daydream.service.js', () => ({ searchDaydream: mockSearchDaydream }))

import type { DaydreamProduct } from '@halo/shared'
import { buildDaydreamToolDeclaration, buildTools, dispatchToolCall } from '../gemini-tools.js'

// ── Fixtures ──────────────────────────────────────────────────────────────────

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
    imageUrl: 'https://cdn.example.com/boot.jpg',
    sizesInStock: 3,
    sizesTotal: 5,
    shopUrl: 'https://shop.example.com/boot',
    ...overrides,
  }
}

const MOCK_DB = {} as never
const OPTS = { db: MOCK_DB, userId: 'user-abc', conversationId: 'conv-xyz' }

beforeEach(() => {
  mockSearchDaydream.mockReset()
})

// ── buildDaydreamToolDeclaration ───────────────────────────────────────────────

describe('buildDaydreamToolDeclaration', () => {
  it('returns a function declaration with name search', () => {
    const decl = buildDaydreamToolDeclaration()
    expect(decl.functionDeclarations).toHaveLength(1)
    expect(decl.functionDeclarations[0]!.name).toBe('search')
  })

  it('declares a required string parameter named query', () => {
    const decl = buildDaydreamToolDeclaration()
    const params = decl.functionDeclarations[0]!.parameters
    expect(params.properties.query.type).toBe('string')
    expect(params.required).toContain('query')
  })
})

// ── buildTools ────────────────────────────────────────────────────────────────

describe('buildTools', () => {
  it('includes search only for the fashion topic', () => {
    const tools = buildTools('fashion')
    expect(tools).toHaveLength(1)
    expect(tools[0]!.functionDeclarations[0]!.name).toBe('search')
  })

  it('returns an empty array for food_and_restaurants', () => {
    expect(buildTools('food_and_restaurants')).toHaveLength(0)
  })

  it('returns an empty array for lifestyle_and_travel', () => {
    expect(buildTools('lifestyle_and_travel')).toHaveLength(0)
  })
})

// ── dispatchToolCall ──────────────────────────────────────────────────────────

describe('dispatchToolCall', () => {
  it('calls searchDaydream with the Gemini-provided query and returns products', async () => {
    const products = [makeProduct()]
    mockSearchDaydream.mockResolvedValueOnce(products)

    const result = await dispatchToolCall(
      { name: 'search', args: { query: 'brown chelsea boots' } },
      OPTS,
    )

    expect(mockSearchDaydream).toHaveBeenCalledOnce()
    const [query, opts] = mockSearchDaydream.mock.calls[0]!
    expect(query).toBe('brown chelsea boots')
    expect(opts.userId).toBe('user-abc')
    expect(result.products).toHaveLength(1)
    expect(result.products[0]!.name).toBe('Chelsea Boot')
  })

  it('returns an empty product list when searchDaydream returns []', async () => {
    mockSearchDaydream.mockResolvedValueOnce([])
    const result = await dispatchToolCall(
      { name: 'search', args: { query: 'socks' } },
      OPTS,
    )
    expect(result.products).toHaveLength(0)
  })

  it('throws for unknown tool names', async () => {
    await expect(dispatchToolCall({ name: 'unknown_tool', args: {} }, OPTS)).rejects.toThrow(
      /unknown tool/i,
    )
  })

  it('returns a functionResponse-shaped content block for Gemini', async () => {
    mockSearchDaydream.mockResolvedValueOnce([makeProduct()])
    const result = await dispatchToolCall(
      { name: 'search', args: { query: 'boots' } },
      OPTS,
    )
    // Result must carry the functionResponse so the caller can inject it back into Gemini.
    expect(result.functionResponse).toMatchObject({
      name: 'search',
      response: expect.objectContaining({ products: expect.any(Array) }),
    })
  })
})
