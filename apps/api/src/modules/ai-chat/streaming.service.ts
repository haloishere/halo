import type { FastifyBaseLogger } from 'fastify'
import type { AiClient, AiContent, AiGenerateOptions } from '../../lib/vertex-ai.js'
import type { CircuitBreaker } from '../../lib/circuit-breaker.js'
import { CircuitOpenError } from '../../lib/circuit-breaker.js'

export type StreamEvent =
  | { type: 'chunk'; text: string }
  | { type: 'done'; fullResponse: string; tokenCount: number }
  | { type: 'error'; error: string; partial?: string }
  | { type: 'safety_block'; message: string }

export interface StreamParams {
  aiClient: AiClient
  circuitBreaker: CircuitBreaker
  systemPrompt: string
  contents: AiContent[]
  options?: AiGenerateOptions
  logger?: FastifyBaseLogger
}

/**
 * Stream an AI response via the circuit breaker.
 * Yields StreamEvent discriminated union members as the response comes in.
 */
export async function* streamAiResponse(
  params: StreamParams,
): AsyncGenerator<StreamEvent, void, unknown> {
  const { aiClient, circuitBreaker, systemPrompt, contents, options, logger } = params

  let fullResponse = ''

  try {
    const stream = await circuitBreaker.execute(() =>
      collectStream(aiClient, systemPrompt, contents, options),
    )

    for await (const chunk of stream) {
      // Check for safety block
      if (chunk.finishReason === 'SAFETY') {
        const blocked = chunk.safetyRatings?.some((r) => r.blocked)
        if (blocked) {
          yield {
            type: 'safety_block',
            message:
              "I'm not able to respond to that. Let's focus on how I can support you as a caregiver.",
          }
          return
        }
      }

      if (chunk.text) {
        fullResponse += chunk.text
        yield { type: 'chunk', text: chunk.text }
      }
    }

    // Estimate token count from the full response (~4 chars per token)
    const tokenCount = Math.ceil(fullResponse.length / 4)

    yield { type: 'done', fullResponse, tokenCount }
  } catch (error) {
    if (error instanceof CircuitOpenError) {
      logger?.warn('Circuit breaker is open — AI service unavailable')
      yield {
        type: 'error',
        error: 'AI service is temporarily unavailable. Please try again in a moment.',
        partial: fullResponse || undefined,
      }
      return
    }

    // Mid-stream failure — record for circuit breaker
    circuitBreaker.recordFailure()

    logger?.error({ err: error }, 'AI streaming error')
    yield {
      type: 'error',
      error: 'An error occurred while generating a response. Please try again.',
      partial: fullResponse || undefined,
    }
  }
}

/**
 * Wraps the AI client's generator creation in an async function so the
 * circuit breaker can catch initial connection errors. Stream iteration
 * errors are handled separately in the caller.
 */
async function collectStream(
  aiClient: AiClient,
  systemPrompt: string,
  contents: AiContent[],
  options?: AiGenerateOptions,
) {
  return aiClient.generateContentStream(systemPrompt, contents, options)
}
