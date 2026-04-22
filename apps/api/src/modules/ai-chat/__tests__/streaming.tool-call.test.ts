import { describe, it, expect, vi } from 'vitest'
import type { DaydreamProduct } from '@halo/shared'
import type { AiClient } from '../../../lib/vertex-ai.js'
import type { ToolCallResult } from '../gemini-tools.js'
import { CircuitBreaker } from '../../../lib/circuit-breaker.js'
import { streamAiResponse } from '../streaming.service.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeProduct(): DaydreamProduct {
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
  }
}

async function* textStream(text: string) {
  yield { text, finishReason: 'STOP' as const }
}

async function* functionCallStream(name: string, args: Record<string, unknown>) {
  yield { text: '', functionCall: { name, args }, finishReason: 'FUNCTION_CALL' as const }
}

function makeAiClient(
  streams: (() => AsyncGenerator<{
    text: string
    functionCall?: { name: string; args: Record<string, unknown> }
    finishReason?: string
  }>)[],
): AiClient {
  let callCount = 0
  return {
    async *generateContentStream(_sys: string, _contents: AiContent[]) {
      const stream = streams[callCount++]
      if (!stream) throw new Error('Unexpected generateContentStream call')
      yield* stream()
    },
    generateContent: vi.fn(),
    countTokens: vi.fn(),
  } as unknown as AiClient
}

function makeCircuitBreaker() {
  return new CircuitBreaker({ failureThreshold: 5, resetTimeoutMs: 30_000 })
}

const BASE_PARAMS = {
  systemPrompt: 'You are Halo.',
  contents: [{ role: 'user' as const, parts: [{ text: 'show me boots' }] }],
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('streamAiResponse — no tool call (food topic)', () => {
  it('streams text and done event without invoking any tool dispatcher', async () => {
    const aiClient = makeAiClient([() => textStream('Here are some restaurants.')])
    const circuitBreaker = makeCircuitBreaker()
    const toolDispatcher = vi.fn()

    const events = []
    for await (const event of streamAiResponse({
      aiClient,
      circuitBreaker,
      ...BASE_PARAMS,
      toolDispatcher,
    })) {
      events.push(event)
    }

    const types = events.map((e) => e.type)
    expect(types).toContain('chunk')
    expect(types).toContain('done')
    expect(toolDispatcher).not.toHaveBeenCalled()
  })
})

describe('streamAiResponse — fashion tool-calling path', () => {
  it('detects functionCall, dispatches the tool, emits products event, then streams final reply', async () => {
    const product = makeProduct()
    const toolResult: ToolCallResult = {
      products: [product],
      functionResponse: { name: 'daydream_search', response: { products: [product] } },
    }
    const toolDispatcher = vi.fn().mockResolvedValueOnce(toolResult)

    // First Gemini call → functionCall; second → final text after functionResponse.
    const aiClient = makeAiClient([
      () => functionCallStream('daydream_search', { query: 'brown chelsea boots' }),
      () => textStream("Here's what I found from Daydream:"),
    ])

    const events = []
    for await (const event of streamAiResponse({
      aiClient,
      circuitBreaker: makeCircuitBreaker(),
      ...BASE_PARAMS,
      toolDispatcher,
    })) {
      events.push(event)
    }

    // Tool dispatcher was called with the Gemini-provided args.
    expect(toolDispatcher).toHaveBeenCalledOnce()
    expect(toolDispatcher.mock.calls[0]![0]).toMatchObject({
      name: 'daydream_search',
      args: { query: 'brown chelsea boots' },
    })

    // A `products` event was emitted.
    const productsEvent = events.find((e) => e.type === 'products')
    expect(productsEvent).toBeDefined()
    expect(
      (productsEvent as { type: 'products'; products: DaydreamProduct[] }).products,
    ).toHaveLength(1)

    // The final `done` event carries the natural-language text.
    const doneEvent = events.find((e) => e.type === 'done')
    expect(doneEvent).toBeDefined()
    expect((doneEvent as { type: 'done'; fullResponse: string }).fullResponse).toContain(
      "Here's what I found",
    )
  })

  it('emits products event before the done event', async () => {
    const product = makeProduct()
    const toolResult: ToolCallResult = {
      products: [product],
      functionResponse: { name: 'daydream_search', response: { products: [product] } },
    }
    const toolDispatcher = vi.fn().mockResolvedValueOnce(toolResult)

    const aiClient = makeAiClient([
      () => functionCallStream('daydream_search', { query: 'sneakers' }),
      () => textStream('Found some sneakers for you.'),
    ])

    const events = []
    for await (const event of streamAiResponse({
      aiClient,
      circuitBreaker: makeCircuitBreaker(),
      ...BASE_PARAMS,
      toolDispatcher,
    })) {
      events.push(event)
    }

    const productIdx = events.findIndex((e) => e.type === 'products')
    const doneIdx = events.findIndex((e) => e.type === 'done')
    expect(productIdx).toBeGreaterThanOrEqual(0)
    expect(productIdx).toBeLessThan(doneIdx)
  })

  it('continues gracefully and emits done if the tool dispatcher returns empty products', async () => {
    const toolResult: ToolCallResult = {
      products: [],
      functionResponse: { name: 'daydream_search', response: { products: [] } },
    }
    const toolDispatcher = vi.fn().mockResolvedValueOnce(toolResult)

    const aiClient = makeAiClient([
      () => functionCallStream('daydream_search', { query: 'nothing' }),
      () => textStream("Sorry, I couldn't find anything."),
    ])

    const events = []
    for await (const event of streamAiResponse({
      aiClient,
      circuitBreaker: makeCircuitBreaker(),
      ...BASE_PARAMS,
      toolDispatcher,
    })) {
      events.push(event)
    }

    const productsEvent = events.find((e) => e.type === 'products')
    expect(productsEvent).toBeDefined()
    expect(
      (productsEvent as { type: 'products'; products: DaydreamProduct[] }).products,
    ).toHaveLength(0)

    const doneEvent = events.find((e) => e.type === 'done')
    expect(doneEvent).toBeDefined()
  })

  it('emits a product-specific error and done when the toolDispatcher rejects — does NOT record a circuit breaker failure', async () => {
    const toolDispatcher = vi.fn().mockRejectedValueOnce(new Error('Daydream unavailable'))

    const aiClient = makeAiClient([() => functionCallStream('daydream_search', { query: 'boots' })])
    const circuitBreaker = makeCircuitBreaker()
    const recordFailureSpy = vi.spyOn(circuitBreaker, 'recordFailure')

    const events = []
    for await (const event of streamAiResponse({
      aiClient,
      circuitBreaker,
      ...BASE_PARAMS,
      toolDispatcher,
    })) {
      events.push(event)
    }

    const errorEvent = events.find((e) => e.type === 'error')
    expect(errorEvent).toBeDefined()
    expect((errorEvent as { type: 'error'; error: string }).error).toContain('Product search')

    const doneEvent = events.find((e) => e.type === 'done')
    expect(doneEvent).toBeDefined()

    expect(recordFailureSpy).not.toHaveBeenCalled()
  })

  it('does not make a second Gemini call when no toolDispatcher is provided', async () => {
    // Without a dispatcher, a functionCall chunk is treated as plain text (no op).
    const generateSpy = vi
      .fn()
      .mockImplementation(() => functionCallStream('daydream_search', { query: 'x' }))
    const aiClient = {
      generateContentStream: generateSpy,
      generateContent: vi.fn(),
      countTokens: vi.fn(),
    } as unknown as AiClient

    const events = []
    for await (const event of streamAiResponse({
      aiClient,
      circuitBreaker: makeCircuitBreaker(),
      ...BASE_PARAMS,
    })) {
      events.push(event)
    }

    expect(generateSpy).toHaveBeenCalledOnce()
    expect(events.find((e) => e.type === 'products')).toBeUndefined()
  })
})
