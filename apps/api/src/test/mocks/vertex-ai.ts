import { vi } from 'vitest'
import type {
  AiClient,
  AiGenerateOptions,
  AiStreamChunk,
  AiTokenCount,
} from '../../lib/vertex-ai.js'

export function createMockAiClient(): AiClient & {
  mockStreamSuccess: (chunks: string[]) => void
  mockStreamError: (chunksBeforeError: string[], error?: Error) => void
  mockSafetyBlock: (partialText?: string) => void
  mockQuotaExhausted: () => void
  mockCountTokens: (result: AiTokenCount) => void
  generateContentStream: ReturnType<typeof vi.fn>
  countTokens: ReturnType<typeof vi.fn>
}

export function createMockAiClient() {
  let streamBehavior:
    | { type: 'success'; chunks: string[] }
    | { type: 'error'; chunks: string[]; error: Error }
    | { type: 'safety'; partial: string }
    | { type: 'quota' }
    | null = null

  let tokenResult: AiTokenCount = { totalTokens: 10 }

  const client = {
    generateContentStream: vi.fn(
      // Return type matches AiClient interface: AsyncGenerator
      // For quota errors, throw before returning the generator (simulates API rejection)
      (
        _systemPrompt: string,
        _contents: unknown[],
        _options?: AiGenerateOptions,
      ): AsyncGenerator<AiStreamChunk, void, unknown> => {
        if (streamBehavior?.type === 'quota') {
          throw Object.assign(new Error('Resource exhausted'), {
            code: 429,
            status: 'RESOURCE_EXHAUSTED',
          })
        }

        async function* generate(): AsyncGenerator<AiStreamChunk, void, unknown> {
          if (!streamBehavior) {
            yield { text: 'default response' }
            return
          }

          switch (streamBehavior.type) {
            case 'success':
              for (const text of streamBehavior.chunks) {
                yield { text }
              }
              return

            case 'error':
              for (const text of streamBehavior.chunks) {
                yield { text }
              }
              throw streamBehavior.error

            case 'safety':
              if (streamBehavior.partial) {
                yield { text: streamBehavior.partial }
              }
              yield {
                text: '',
                finishReason: 'SAFETY',
                safetyRatings: [
                  {
                    category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
                    probability: 'HIGH',
                    blocked: true,
                  },
                ],
              }
              return
          }
        }

        return generate()
      },
    ),

    countTokens: vi.fn(async (): Promise<AiTokenCount> => tokenResult),

    mockStreamSuccess(chunks: string[]) {
      streamBehavior = { type: 'success', chunks }
    },

    mockStreamError(chunksBeforeError: string[], error = new Error('Stream interrupted')) {
      streamBehavior = { type: 'error', chunks: chunksBeforeError, error }
    },

    mockSafetyBlock(partialText = '') {
      streamBehavior = { type: 'safety', partial: partialText }
    },

    mockQuotaExhausted() {
      streamBehavior = { type: 'quota' }
    },

    mockCountTokens(result: AiTokenCount) {
      tokenResult = result
    },
  }

  return client
}
