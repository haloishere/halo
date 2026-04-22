import { describe, it, expect, vi, beforeEach } from 'vitest'
import { streamMessage } from '../ai-streaming'

vi.mock('../../lib/firebase', () => ({
  auth: {
    currentUser: {
      getIdToken: vi.fn().mockResolvedValue('test-token'),
    },
  },
}))

/**
 * Mock XMLHttpRequest that simulates progressive SSE delivery.
 * Each chunk in `chunks` triggers an onprogress event with cumulative responseText.
 */
function mockXHR(chunks: string[], status = 200) {
  const xhrInstance = {
    open: vi.fn(),
    setRequestHeader: vi.fn(),
    send: vi.fn(),
    abort: vi.fn(),
    status,
    responseText: '',
    onprogress: null as (() => void) | null,
    onload: null as (() => void) | null,
    onerror: null as (() => void) | null,
    ontimeout: null as (() => void) | null,
  }

  // When send() is called, deliver chunks asynchronously
  xhrInstance.send.mockImplementation(() => {
    setTimeout(() => {
      if (status >= 400) {
        xhrInstance.responseText = JSON.stringify({ error: `HTTP ${status}` })
        xhrInstance.onload?.()
        return
      }

      for (const chunk of chunks) {
        xhrInstance.responseText += chunk
        xhrInstance.onprogress?.()
      }
      xhrInstance.onload?.()
    }, 0)
  })

  global.XMLHttpRequest = vi
    .fn()
    .mockImplementation(() => xhrInstance) as unknown as typeof XMLHttpRequest

  return xhrInstance
}

function makeCallbacks() {
  const state = {
    chunks: [] as string[],
    doneCount: 0,
    errors: [] as string[],
    crisisResources: [] as string[],
  }
  return {
    get chunks() {
      return state.chunks
    },
    get doneCount() {
      return state.doneCount
    },
    get errors() {
      return state.errors
    },
    get crisisResources() {
      return state.crisisResources
    },
    onChunk: (text: string) => {
      state.chunks.push(text)
    },
    onDone: () => {
      state.doneCount++
    },
    onError: (error: string) => {
      state.errors.push(error)
    },
    onSafetyBlock: (msg: string) => {
      state.errors.push(`[SAFETY] ${msg}`)
    },
    onCrisisResources: (resources: string) => {
      state.crisisResources.push(resources)
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('streamMessage', () => {
  it('parses SSE chunks and calls onChunk', async () => {
    mockXHR([
      'event: message\ndata: {"text":"Hello "}\n\n',
      'event: message\ndata: {"text":"world!"}\n\ndata: [DONE]\n\n',
    ])

    const callbacks = makeCallbacks()
    await streamMessage('conv-1', 'Hi', callbacks)

    expect(callbacks.chunks).toEqual(['Hello ', 'world!'])
    expect(callbacks.doneCount).toBe(1)
  })

  it('handles error event', async () => {
    mockXHR(['event: error\ndata: {"message":"Service unavailable"}\n\n'])

    const callbacks = makeCallbacks()
    await streamMessage('conv-1', 'Hi', callbacks)

    expect(callbacks.errors).toEqual(['Service unavailable'])
  })

  it('handles safety block event', async () => {
    mockXHR(['event: safety_block\ndata: {"message":"Blocked"}\n\n'])

    const callbacks = makeCallbacks()
    await streamMessage('conv-1', 'Hi', callbacks)

    expect(callbacks.errors).toEqual(['[SAFETY] Blocked'])
  })

  it('handles non-200 HTTP responses', async () => {
    mockXHR([], 422)

    const callbacks = makeCallbacks()
    await streamMessage('conv-1', 'Hi', callbacks)

    expect(callbacks.errors).toHaveLength(1)
    expect(callbacks.errors[0]).toContain('422')
  })

  it('handles abort signal gracefully', async () => {
    const controller = new AbortController()
    mockXHR(['event: message\ndata: {"text":"Hello"}\n\ndata: [DONE]\n\n'])

    const callbacks = makeCallbacks()
    // Should complete without throwing even with abort signal
    await streamMessage('conv-1', 'Hi', callbacks, controller.signal)

    // No errors from aborting
    expect(callbacks.errors).toHaveLength(0)
  })

  it('handles network error', async () => {
    const xhrInstance = mockXHR([])
    xhrInstance.send.mockImplementation(() => {
      setTimeout(() => {
        xhrInstance.onerror?.()
      }, 0)
    })

    const callbacks = makeCallbacks()
    await streamMessage('conv-1', 'Hi', callbacks)

    expect(callbacks.errors).toEqual(['Network error'])
  })

  it('parses crisis_resources SSE event', async () => {
    mockXHR([
      'event: crisis_resources\ndata: {"resources":"Call 988"}\n\n',
      'event: message\ndata: {"text":"I hear you."}\n\ndata: [DONE]\n\n',
    ])

    const callbacks = makeCallbacks()
    await streamMessage('conv-1', 'Hi', callbacks)

    expect(callbacks.crisisResources).toEqual(['Call 988'])
    expect(callbacks.chunks).toEqual(['I hear you.'])
    expect(callbacks.doneCount).toBe(1)
  })

  it('calls onProducts when a products SSE event arrives', async () => {
    const product = {
      id: 'p1',
      brand: 'Acme',
      name: 'Chelsea Boot',
      description: null,
      priceCents: 15000,
      regularPriceCents: 20000,
      onSale: true,
      currency: 'USD',
      imageUrl: 'https://cdn.example.com/boot.jpg',
      sizesInStock: 3,
      sizesTotal: 5,
      shopUrl: 'https://shop.example.com/boot',
    }
    const productsJson = JSON.stringify({ products: [product] })

    mockXHR([
      `event: products\ndata: ${productsJson}\n\n`,
      'event: message\ndata: {"text":"Found this!"}\n\ndata: [DONE]\n\n',
    ])

    const receivedProducts: unknown[] = []
    const callbacks = makeCallbacks()
    const callbacksWithProducts = {
      ...callbacks,
      onProducts: (products: unknown[]) => {
        receivedProducts.push(...products)
      },
    }
    await streamMessage('conv-1', 'brown boots', callbacksWithProducts)

    expect(receivedProducts).toHaveLength(1)
    expect((receivedProducts[0] as { id: string }).id).toBe('p1')
    expect(callbacks.doneCount).toBe(1)
  })

  it('does NOT call onProducts when all items in the products event fail Zod validation', async () => {
    // Missing required fields (id, shopUrl, priceCents) — all items invalid.
    const badProduct = { brand: 'Acme', name: 'Bad Product' }
    const productsJson = JSON.stringify({ products: [badProduct] })

    mockXHR([
      `event: products\ndata: ${productsJson}\n\n`,
      'event: message\ndata: {"text":"Anyway..."}\n\ndata: [DONE]\n\n',
    ])

    const onProductsSpy = vi.fn()
    const baseCallbacks = makeCallbacks()
    // Spread creates a static snapshot of getters — read doneCount from
    // baseCallbacks (which retains the live getter over the internal state).
    await streamMessage('conv-1', 'any query', { ...baseCallbacks, onProducts: onProductsSpy })

    expect(onProductsSpy).not.toHaveBeenCalled()
    expect(baseCallbacks.doneCount).toBe(1)
  })
})
