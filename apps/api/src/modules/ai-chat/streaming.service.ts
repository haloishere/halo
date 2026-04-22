import type { FastifyBaseLogger } from 'fastify'
import type { AiClient, AiContent, AiGenerateOptions } from '../../lib/vertex-ai.js'
import type { CircuitBreaker } from '../../lib/circuit-breaker.js'
import type { ToolCallResult } from './gemini-tools.js'
import type { DaydreamProduct } from '@halo/shared'
import { CircuitOpenError } from '../../lib/circuit-breaker.js'

export type StreamEvent =
  | { type: 'chunk'; text: string }
  | { type: 'done'; fullResponse: string; tokenCount: number }
  | { type: 'error'; error: string; partial?: string }
  | { type: 'safety_block'; message: string }
  | { type: 'products'; products: DaydreamProduct[] }

const SAFETY_BLOCK_MESSAGE =
  "I'm not able to respond to that. Let's keep our conversation focused on how I can help you."

export interface StreamParams {
  aiClient: AiClient
  circuitBreaker: CircuitBreaker
  systemPrompt: string
  contents: AiContent[]
  options?: AiGenerateOptions
  logger?: FastifyBaseLogger
  /** Dispatcher for Gemini function calls. Provide only for topics that expose tools.
   *  The caller should bind context (db, userId, conversationId) into a closure. */
  toolDispatcher?: (call: {
    name: string
    args: Record<string, unknown>
  }) => Promise<ToolCallResult>
}

/**
 * Stream an AI response via the circuit breaker.
 * Yields StreamEvent discriminated union members as the response comes in.
 *
 * When a functionCall chunk arrives and a toolDispatcher is provided, the
 * service dispatches the tool, emits a `products` event, then makes a second
 * Gemini call with the functionResponse injected into contents. Only one tool
 * call per turn is supported (V1).
 */
export async function* streamAiResponse(
  params: StreamParams,
): AsyncGenerator<StreamEvent, void, unknown> {
  const { aiClient, circuitBreaker, systemPrompt, contents, options, logger, toolDispatcher } =
    params

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
          yield { type: 'safety_block', message: SAFETY_BLOCK_MESSAGE }
          return
        }
      }

      // Function-call round-trip (fashion tool-calling, V1: single tool call per turn).
      if (chunk.functionCall && toolDispatcher) {
        let toolResult: ToolCallResult
        try {
          toolResult = await toolDispatcher(chunk.functionCall)
        } catch (toolError) {
          // Tool dispatch (Daydream) failed — this is NOT a Vertex AI failure, so
          // we must NOT call circuitBreaker.recordFailure(). Yield a product-specific
          // error and let the turn end gracefully with a done event.
          logger?.error({ err: toolError }, 'Tool dispatch failed')
          yield {
            type: 'error',
            error: 'Product search is temporarily unavailable. Please try again in a moment.',
          }
          yield { type: 'done', fullResponse, tokenCount: Math.ceil(fullResponse.length / 4) }
          return
        }

        yield { type: 'products', products: toolResult.products }

        // Build second-pass contents: original messages → model functionCall → user functionResponse.
        const secondPassContents: AiContent[] = [
          ...contents,
          { role: 'model', parts: [{ functionCall: chunk.functionCall }] },
          { role: 'user', parts: [{ functionResponse: toolResult.functionResponse }] },
        ]

        // Strip function declarations from second-pass options — the follow-up
        // turn is a natural-language summary; Gemini must not loop on another tool call.
        const secondPassOptions = options?.tools
          ? { tools: options.tools.filter((t) => !('functionDeclarations' in t)) }
          : undefined

        const stream2 = await circuitBreaker.execute(() =>
          collectStream(aiClient, systemPrompt, secondPassContents, secondPassOptions),
        )

        for await (const chunk2 of stream2) {
          if (chunk2.finishReason === 'SAFETY') {
            const blocked = chunk2.safetyRatings?.some((r) => r.blocked)
            if (blocked) {
              yield { type: 'safety_block', message: SAFETY_BLOCK_MESSAGE }
              return
            }
          }
          if (chunk2.text) {
            fullResponse += chunk2.text
            yield { type: 'chunk', text: chunk2.text }
          }
        }

        // One tool call per turn — exit the first-pass stream.
        break
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
