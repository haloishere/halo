import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ────────────────────────────────────────────────────────────────────
// vi.hoisted ensures variables are initialized before the hoisted vi.mock factory runs.
const { mockGetJwt, mockForceRefreshJwt } = vi.hoisted(() => ({
  mockGetJwt: vi.fn(),
  mockForceRefreshJwt: vi.fn(),
}))

vi.mock('../daydream.jwt.js', () => ({
  getJwt: mockGetJwt,
  forceRefreshJwt: mockForceRefreshJwt,
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { search, sendMessage, listProducts, GrpcUnauthenticatedError } from '../daydream.client.js'

// ── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_JWT = {
  idToken: 'test-id-token',
  refreshToken: 'test-refresh-token',
  firebaseApiKey: 'test-api-key',
  expiresAt: Date.now() + 3_600_000,
  capturedAt: Date.now(),
}

const FRESH_JWT = { ...MOCK_JWT, idToken: 'fresh-id-token' }

// Build a minimal BFF binary response containing two UUIDs (chatId + messageId).
function buildBffResponse(chatId: string, msgId: string): ArrayBuffer {
  const text = `data ${chatId} ${msgId} end`
  const enc = new TextEncoder().encode(text)
  // Prefix with 5-byte gRPC-web frame header (flag=0, length=enc.length).
  const buf = new Uint8Array(5 + enc.length)
  new DataView(buf.buffer).setUint32(1, enc.length, false)
  buf.set(enc, 5)
  return buf.buffer
}

function buildBffHeaders(grpcStatus = '0'): Headers {
  const h = new Headers()
  h.set('grpc-status', grpcStatus)
  return h
}

const MOCK_CHAT_ID = '11111111-1111-1111-1111-111111111111'
const MOCK_MSG_ID = '22222222-2222-2222-2222-222222222222'

const MOCK_LIAISON_RESPONSE = {
  products: [
    {
      id: 'prod-1',
      name: 'Chelsea Boot',
      description: 'Brown leather',
      brandData: { name: 'Acme' },
      options: [
        {
          mainImage: 'products/boot.jpg',
          pricingSummary: {
            effectiveBuyMin: 15000,
            regularMinPrice: 20000,
          },
          variants: [
            {
              availabilityState: 'AVAILABILITY_STATE_AVAILABLE',
              clickoutUrl: 'https://shop.example.com/boot',
            },
          ],
        },
      ],
    },
  ],
}

beforeEach(() => {
  mockGetJwt.mockReset()
  mockForceRefreshJwt.mockReset()
  mockFetch.mockReset()
  mockGetJwt.mockResolvedValue(MOCK_JWT)
  mockForceRefreshJwt.mockResolvedValue(FRESH_JWT)
})

// ── sendMessage ───────────────────────────────────────────────────────────────

describe('sendMessage', () => {
  it('sends to the BFF and extracts chatId + messageId', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: buildBffHeaders(),
      // Response embeds MOCK_CHAT_ID and MOCK_MSG_ID; extractMessageId returns
      // the UUID that is NOT equal to the request's chatId.
      arrayBuffer: () => Promise.resolve(buildBffResponse(MOCK_CHAT_ID, MOCK_MSG_ID)),
    })

    // Pass chatId explicitly so result.chatId is deterministic.
    const result = await sendMessage('chelsea boots', { chatId: MOCK_CHAT_ID })
    expect(result.chatId).toBe(MOCK_CHAT_ID)
    expect(result.messageId).toBe(MOCK_MSG_ID)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('GetModuleList'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ authorization: `Bearer ${MOCK_JWT.idToken}` }),
      }),
    )
  })

  it('retries with a fresh JWT on grpc-status: 16 (UNAUTHENTICATED)', async () => {
    // First call: expired JWT → grpc-status: 16
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: buildBffHeaders('16'),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      text: () => Promise.resolve('UNAUTHENTICATED'),
    })
    // Second call: fresh JWT → success
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: buildBffHeaders(),
      arrayBuffer: () => Promise.resolve(buildBffResponse(MOCK_CHAT_ID, MOCK_MSG_ID)),
    })

    // Pass chatId explicitly so result.chatId is deterministic.
    const result = await sendMessage('chelsea boots', { chatId: MOCK_CHAT_ID })
    expect(result.chatId).toBe(MOCK_CHAT_ID)
    expect(mockForceRefreshJwt).toHaveBeenCalledOnce()
    // Second fetch must use the fresh JWT's idToken.
    const secondCall = mockFetch.mock.calls[1]!
    expect((secondCall[1] as RequestInit).headers).toMatchObject({
      authorization: `Bearer ${FRESH_JWT.idToken}`,
    })
  })

  it('throws when the BFF returns a non-OK HTTP status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      text: () => Promise.resolve('Service Unavailable'),
    })
    await expect(sendMessage('boots')).rejects.toThrow('BFF send failed: 503')
  })

  it('throws GrpcUnauthenticatedError after a failed force-refresh', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      headers: buildBffHeaders('16'),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      text: () => Promise.resolve('UNAUTHENTICATED'),
    })

    await expect(sendMessage('boots')).rejects.toThrow(GrpcUnauthenticatedError)
    await expect(sendMessage('boots')).rejects.toThrow(/UNAUTHENTICATED/)
  })

  it('throws when BFF response contains no UUID distinct from chatId', async () => {
    // Response body contains only the chatId UUID — no separate messageId.
    const chatIdOnly = MOCK_CHAT_ID
    const enc = new TextEncoder().encode(`data ${chatIdOnly} end`)
    const buf = new Uint8Array(5 + enc.length)
    new DataView(buf.buffer).setUint32(1, enc.length, false)
    buf.set(enc, 5)

    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: buildBffHeaders(),
      arrayBuffer: () => Promise.resolve(buf.buffer),
    })

    await expect(sendMessage('boots', { chatId: MOCK_CHAT_ID })).rejects.toThrow(
      /BFF response contained no UUID distinct from chatId/,
    )
  })
})

// ── listProducts ──────────────────────────────────────────────────────────────

describe('listProducts', () => {
  it('fetches product cards from the liaison endpoint and maps them', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(MOCK_LIAISON_RESPONSE),
    })

    const products = await listProducts(MOCK_CHAT_ID, MOCK_MSG_ID)
    expect(products).toHaveLength(1)
    expect(products[0]!.name).toBe('Chelsea Boot')
    expect(products[0]!.brand).toBe('Acme')
    expect(products[0]!.priceCents).toBe(15000)
    expect(products[0]!.onSale).toBe(true)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('ListProductCards'),
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('returns an empty array when the response has no products', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    })
    const products = await listProducts(MOCK_CHAT_ID, MOCK_MSG_ID)
    expect(products).toHaveLength(0)
  })

  it('throws when the liaison endpoint returns a non-OK status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      text: () => Promise.resolve('Service Unavailable'),
    })
    await expect(listProducts(MOCK_CHAT_ID, MOCK_MSG_ID)).rejects.toThrow(
      'Liaison list failed: 503',
    )
  })

  it('builds a CDN URL for products/ image paths', async () => {
    const cdnProduct = {
      ...MOCK_LIAISON_RESPONSE.products[0]!,
      options: [
        {
          ...MOCK_LIAISON_RESPONSE.products[0]!.options![0]!,
          mainImage: 'products/boot.jpg',
        },
      ],
    }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ products: [cdnProduct] }),
    })
    const [product] = await listProducts(MOCK_CHAT_ID, MOCK_MSG_ID)
    expect(product!.imageUrl).toContain('cdn.dahlialabs.dev')
    expect(product!.imageUrl).toContain('boot.jpg')
  })

  it('passes through absolute http image URLs unchanged', async () => {
    const httpProduct = {
      ...MOCK_LIAISON_RESPONSE.products[0]!,
      options: [
        {
          ...MOCK_LIAISON_RESPONSE.products[0]!.options![0]!,
          mainImage: 'https://external.cdn.example.com/img.jpg',
        },
      ],
    }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ products: [httpProduct] }),
    })
    const [product] = await listProducts(MOCK_CHAT_ID, MOCK_MSG_ID)
    expect(product!.imageUrl).toBe('https://external.cdn.example.com/img.jpg')
  })
})

// ── search ────────────────────────────────────────────────────────────────────

describe('search', () => {
  it('chains sendMessage → listProducts and returns combined result', async () => {
    // BFF — chatId is generated internally by search(), so we can't assert the
    // exact value. Embed two distinct UUIDs in the response body so
    // extractMessageId can find the messageId.
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: buildBffHeaders(),
      arrayBuffer: () => Promise.resolve(buildBffResponse(MOCK_CHAT_ID, MOCK_MSG_ID)),
    })
    // Liaison
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(MOCK_LIAISON_RESPONSE),
    })

    const result = await search('brown chelsea boots')
    expect(typeof result.chatId).toBe('string')
    expect(result.products).toHaveLength(1)
    expect(result.products[0]!.name).toBe('Chelsea Boot')
  })
})
