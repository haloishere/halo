import { describe, it, expect } from 'vitest'
import { createMockAiClient } from '../../../test/mocks/vertex-ai.js'
import { CircuitBreaker } from '../../../lib/circuit-breaker.js'
import { streamAiResponse } from '../streaming.service.js'
import type { StreamEvent } from '../streaming.service.js'

async function collectEvents(
  params: Parameters<typeof streamAiResponse>[0],
): Promise<StreamEvent[]> {
  const events: StreamEvent[] = []
  for await (const event of streamAiResponse(params)) {
    events.push(event)
  }
  return events
}

function makeParams(overrides: Partial<Parameters<typeof streamAiResponse>[0]> = {}) {
  return {
    aiClient: createMockAiClient(),
    circuitBreaker: new CircuitBreaker(),
    systemPrompt: 'You are Halo.',
    contents: [{ role: 'user' as const, parts: [{ text: 'Hello' }] }],
    ...overrides,
  }
}

describe('streamAiResponse', () => {
  it('streams chunks and emits done event on success', async () => {
    const client = createMockAiClient()
    client.mockStreamSuccess(['Hello ', 'world!'])

    const events = await collectEvents(makeParams({ aiClient: client }))

    expect(events).toHaveLength(3) // 2 chunks + 1 done
    expect(events[0]).toEqual({ type: 'chunk', text: 'Hello ' })
    expect(events[1]).toEqual({ type: 'chunk', text: 'world!' })
    expect(events[2]).toMatchObject({ type: 'done', fullResponse: 'Hello world!' })
  })

  it('yields safety_block on SAFETY finish reason', async () => {
    const client = createMockAiClient()
    client.mockSafetyBlock()

    const events = await collectEvents(makeParams({ aiClient: client }))

    expect(events).toHaveLength(1)
    expect(events[0]!.type).toBe('safety_block')
  })

  it('yields error with partial text on mid-stream failure', async () => {
    const client = createMockAiClient()
    client.mockStreamError(['Partial '], new Error('Stream died'))

    const events = await collectEvents(makeParams({ aiClient: client }))

    const errorEvent = events.find((e) => e.type === 'error')
    expect(errorEvent).toBeDefined()
    expect(errorEvent!.type === 'error' && errorEvent!.partial).toBe('Partial ')
  })

  it('yields circuit breaker error when circuit is open', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1 })
    const client = createMockAiClient()
    client.mockQuotaExhausted()

    // Trip the circuit
    await collectEvents(makeParams({ aiClient: client, circuitBreaker: cb }))

    // Now circuit should be open — next call should get CircuitOpenError
    const client2 = createMockAiClient()
    client2.mockStreamSuccess(['test'])

    const events = await collectEvents(makeParams({ aiClient: client2, circuitBreaker: cb }))

    expect(events).toHaveLength(1)
    expect(events[0]!.type).toBe('error')
    if (events[0]!.type === 'error') {
      expect(events[0]!.error).toContain('temporarily unavailable')
    }
  })

  it('emits done with empty response when no chunks received', async () => {
    const client = createMockAiClient()
    client.mockStreamSuccess([])

    const events = await collectEvents(makeParams({ aiClient: client }))

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ type: 'done', fullResponse: '', tokenCount: 0 })
  })

  it('records failure on mid-stream error and opens circuit', async () => {
    // execute().onSuccess() fires when collectStream resolves, resetting count.
    // With threshold 1, a single mid-stream recordFailure() opens the circuit.
    const cb = new CircuitBreaker({ failureThreshold: 1 })

    const client = createMockAiClient()
    client.mockStreamError(['Partial '], new Error('Stream died'))
    await collectEvents(makeParams({ aiClient: client, circuitBreaker: cb }))

    expect(cb.getState()).toBe('open')
  })

  it('records success after complete streaming', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1 })
    const client = createMockAiClient()
    client.mockStreamSuccess(['Hello!'])

    await collectEvents(makeParams({ aiClient: client, circuitBreaker: cb }))

    expect(cb.getState()).toBe('closed')
  })

  it('passes options through to aiClient.generateContentStream', async () => {
    const client = createMockAiClient()
    client.mockStreamSuccess(['grounded response'])

    const ragTools = [
      {
        retrieval: {
          vertexRagStore: {
            ragResources: [{ ragCorpus: 'projects/p/locations/l/ragCorpora/123' }],
          },
        },
      },
    ]

    await collectEvents(makeParams({ aiClient: client, options: { tools: ragTools } }))

    expect(client.generateContentStream).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Array),
      { tools: ragTools },
    )
  })

  it('works without options (backward compatible)', async () => {
    const client = createMockAiClient()
    client.mockStreamSuccess(['response'])

    await collectEvents(makeParams({ aiClient: client }))

    expect(client.generateContentStream).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Array),
      undefined,
    )
  })
})
