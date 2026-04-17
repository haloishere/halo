import { describe, it, expect } from 'vitest'
import { estimateTokenCount, countTokensViaApi } from '../token-counter.js'
import { createMockAiClient } from '../../../test/mocks/vertex-ai.js'

describe('estimateTokenCount', () => {
  it('returns 0 for empty string', () => {
    expect(estimateTokenCount('')).toBe(0)
  })

  it('estimates ~1 token per 4 characters', () => {
    // 20 chars → 5 tokens
    expect(estimateTokenCount('abcdefghijklmnopqrst')).toBe(5)
  })

  it('rounds up partial tokens', () => {
    // 5 chars → ceil(5/4) = 2 tokens
    expect(estimateTokenCount('hello')).toBe(2)
  })

  it('handles long text', () => {
    const text = 'a'.repeat(1000)
    expect(estimateTokenCount(text)).toBe(250)
  })

  it('handles single character', () => {
    expect(estimateTokenCount('x')).toBe(1)
  })
})

describe('countTokensViaApi', () => {
  it('returns total tokens from API response', async () => {
    const client = createMockAiClient()
    client.mockCountTokens({ totalTokens: 42, totalBillableCharacters: 168 })

    const result = await countTokensViaApi(client, [
      { role: 'user', parts: [{ text: 'Hello world' }] },
    ])

    expect(result).toBe(42)
  })

  it('calls client.countTokens with provided contents', async () => {
    const client = createMockAiClient()
    const contents = [{ role: 'user' as const, parts: [{ text: 'test' }] }]

    await countTokensViaApi(client, contents)

    expect(client.countTokens).toHaveBeenCalledWith(contents)
  })
})
