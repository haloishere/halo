import { describe, it, expect } from 'vitest'
import { classifyOutput } from '../output-classifier.js'
import { createMockAiClient } from '../../../../test/mocks/vertex-ai.js'

describe('classifyOutput', () => {
  it('returns safe for SAFE classification', async () => {
    const client = createMockAiClient()
    client.mockStreamSuccess(['SAFE'])

    const result = await classifyOutput(client, 'This is helpful caregiver advice')

    expect(result.safe).toBe(true)
  })

  it('returns unsafe for UNSAFE|medical_advice classification', async () => {
    const client = createMockAiClient()
    client.mockStreamSuccess(['UNSAFE|medical_advice'])

    const result = await classifyOutput(client, 'Take 20mg of Donepezil daily')

    expect(result).toMatchObject({ safe: false, category: 'medical_advice' })
  })

  it('returns unsafe for UNSAFE|harmful_content classification', async () => {
    const client = createMockAiClient()
    client.mockStreamSuccess(['UNSAFE|harmful_content'])

    const result = await classifyOutput(client, 'harmful content')

    expect(result).toMatchObject({ safe: false, category: 'harmful_content' })
  })

  it('fails open on timeout (returns safe)', async () => {
    const client = createMockAiClient()
    // Mock a very slow response by using error that takes forever
    client.generateContentStream.mockImplementation(async function* () {
      await new Promise((resolve) => setTimeout(resolve, 10_000))
      yield { text: 'SAFE' }
    })

    const result = await classifyOutput(client, 'test')

    expect(result.safe).toBe(true)
  }, 10_000)

  it('fails open on API error (returns safe)', async () => {
    const client = createMockAiClient()
    client.mockQuotaExhausted()

    const result = await classifyOutput(client, 'test')

    expect(result.safe).toBe(true)
  })

  it('fails open on unrecognized classification output', async () => {
    const client = createMockAiClient()
    client.mockStreamSuccess(['MAYBE'])

    const result = await classifyOutput(client, 'ambiguous content')

    expect(result.safe).toBe(true)
  })
})
