import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { _resetAiClient, initAiClient, getAiClient, createAiClient } from '../vertex-ai.js'

beforeEach(() => {
  _resetAiClient()
})

afterEach(() => {
  vi.unstubAllEnvs()
  _resetAiClient()
})

describe('createAiClient', () => {
  it('throws when VERTEX_AI_PROJECT is missing', () => {
    vi.stubEnv('VERTEX_AI_PROJECT', '')
    vi.stubEnv('VERTEX_AI_LOCATION', 'us-central1')
    vi.stubEnv('VERTEX_AI_MODEL', 'gemini-2.5-flash')

    expect(() => createAiClient()).toThrow('VERTEX_AI_PROJECT env var is required')
  })

  it('throws when VERTEX_AI_LOCATION is missing', () => {
    vi.stubEnv('VERTEX_AI_PROJECT', 'my-project')
    vi.stubEnv('VERTEX_AI_LOCATION', '')
    vi.stubEnv('VERTEX_AI_MODEL', 'gemini-2.5-flash')

    expect(() => createAiClient()).toThrow('VERTEX_AI_LOCATION env var is required')
  })

  it('throws when VERTEX_AI_MODEL is missing', () => {
    vi.stubEnv('VERTEX_AI_PROJECT', 'my-project')
    vi.stubEnv('VERTEX_AI_LOCATION', 'us-central1')
    vi.stubEnv('VERTEX_AI_MODEL', '')

    expect(() => createAiClient()).toThrow('VERTEX_AI_MODEL env var is required')
  })

  it('creates a client when all env vars are set', () => {
    vi.stubEnv('VERTEX_AI_PROJECT', 'my-project')
    vi.stubEnv('VERTEX_AI_LOCATION', 'us-central1')
    vi.stubEnv('VERTEX_AI_MODEL', 'gemini-2.5-flash')

    const client = createAiClient()
    expect(client).toBeDefined()
    expect(typeof client.generateContentStream).toBe('function')
    expect(typeof client.generateContent).toBe('function')
    expect(typeof client.countTokens).toBe('function')
  })
})

describe('initAiClient / getAiClient', () => {
  it('getAiClient throws before initialization', () => {
    expect(() => getAiClient()).toThrow('AI client not initialized')
  })

  it('initAiClient creates and caches the singleton', () => {
    vi.stubEnv('VERTEX_AI_PROJECT', 'p')
    vi.stubEnv('VERTEX_AI_LOCATION', 'l')
    vi.stubEnv('VERTEX_AI_MODEL', 'm')

    const client1 = initAiClient()
    const client2 = initAiClient()
    expect(client1).toBe(client2)
  })

  it('getAiClient returns the initialized singleton', () => {
    vi.stubEnv('VERTEX_AI_PROJECT', 'p')
    vi.stubEnv('VERTEX_AI_LOCATION', 'l')
    vi.stubEnv('VERTEX_AI_MODEL', 'm')

    const init = initAiClient()
    const get = getAiClient()
    expect(init).toBe(get)
  })

  it('_resetAiClient clears the singleton', () => {
    vi.stubEnv('VERTEX_AI_PROJECT', 'p')
    vi.stubEnv('VERTEX_AI_LOCATION', 'l')
    vi.stubEnv('VERTEX_AI_MODEL', 'm')

    initAiClient()
    _resetAiClient()

    expect(() => getAiClient()).toThrow('AI client not initialized')
  })
})
