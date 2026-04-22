import type { DaydreamProduct, MemoryProposal } from '@halo/shared'
import { auth } from '../lib/firebase'

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'

export interface StreamCallbacks {
  /** Called zero or more times as response chunks arrive */
  onChunk: (text: string) => void
  /** Terminal: called when streaming completes successfully */
  onDone: () => void
  /** Terminal: called on error (network, HTTP, or streaming error) */
  onError: (error: string) => void
  /** Terminal: called when the AI response is blocked by safety filters */
  onSafetyBlock?: (message: string) => void
  /** Non-terminal: called when crisis resources are detected in the input */
  onCrisisResources?: (resources: string) => void
  /**
   * Non-terminal: called when Gemini invokes the daydream_search tool and
   * the server emits a products event. Only fires in fashion-topic conversations.
   */
  onProducts?: (products: DaydreamProduct[]) => void
  /**
   * Non-terminal: called when the server emits a memory proposal (the JSON
   * line Halo tacks onto the end of a turn). Phase-6 confirm/reject UI
   * hooks in here. If unhandled, the event is logged in __DEV__ so future
   * Phase-6 work isn't invisible when debugging the wire.
   */
  onProposal?: (proposal: MemoryProposal) => void
}

/**
 * Parse SSE lines from a buffer, processing complete events.
 * Returns the remaining incomplete buffer.
 */
function processSSEBuffer(
  buffer: string,
  callbacks: StreamCallbacks,
): { remaining: string; finished: boolean } {
  const lines = buffer.split('\n')
  const remaining = lines.pop() ?? ''
  let eventType = ''
  let finished = false

  for (const line of lines) {
    if (line.startsWith('event: ')) {
      eventType = line.slice(7).trim()
    } else if (line.startsWith('data: ')) {
      const data = line.slice(6)

      if (data === '[DONE]') {
        callbacks.onDone()
        finished = true
        return { remaining, finished }
      }

      try {
        const parsed = JSON.parse(data) as Record<string, unknown>

        if (eventType === 'message' && typeof parsed.text === 'string') {
          callbacks.onChunk(parsed.text)
        } else if (eventType === 'error') {
          callbacks.onError(
            (typeof parsed.message === 'string' ? parsed.message : null) ?? 'Unknown error',
          )
          finished = true
          return { remaining, finished }
        } else if (eventType === 'safety_block') {
          callbacks.onSafetyBlock?.(
            (typeof parsed.message === 'string' ? parsed.message : null) ?? 'Message blocked',
          )
          finished = true
          return { remaining, finished }
        } else if (eventType === 'crisis_resources') {
          callbacks.onCrisisResources?.(
            typeof parsed.resources === 'string' ? parsed.resources : '',
          )
        } else if (eventType === 'products') {
          const products = parsed.products
          if (Array.isArray(products)) {
            callbacks.onProducts?.(products as DaydreamProduct[])
          }
        } else if (eventType === 'proposal') {
          // Phase 3 emits `event: proposal` with a `MemoryProposal` payload.
          // Phase 6 UI wires `onProposal` to surface the save/reject strip.
          // Until Phase 6 ships, callers that don't register the handler get
          // a dev-only warn so the event isn't completely invisible.
          callbacks.onProposal?.(parsed as unknown as MemoryProposal)
          if (!callbacks.onProposal && __DEV__) {
            console.warn('SSE: proposal event received but no onProposal handler wired')
          }
        } else if (eventType && __DEV__) {
          console.warn('SSE: unknown event type', eventType, parsed)
        }
      } catch (err) {
        if (__DEV__) {
          console.warn('SSE: Failed to parse JSON data line:', data, err)
        }
      }
    }
  }

  return { remaining, finished }
}

/**
 * Stream an AI message via SSE.
 * Uses XMLHttpRequest for Hermes compatibility (fetch doesn't support ReadableStream in RN).
 */
export async function streamMessage(
  conversationId: string,
  content: string,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  let token: string | undefined
  try {
    token = await auth.currentUser?.getIdToken()
  } catch {
    callbacks.onError('Authentication failed — please sign in again')
    return
  }

  return new Promise<void>((resolve) => {
    const xhr = new XMLHttpRequest()
    let buffer = ''
    let lastIndex = 0

    xhr.open('POST', `${BASE_URL}/v1/ai/conversations/${conversationId}/messages`)
    xhr.setRequestHeader('Content-Type', 'application/json')
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    }

    // Process progressive chunks as they arrive
    xhr.onprogress = () => {
      const newText = xhr.responseText.slice(lastIndex)
      lastIndex = xhr.responseText.length
      buffer += newText

      const result = processSSEBuffer(buffer, callbacks)
      buffer = result.remaining
      if (result.finished) {
        xhr.abort()
        resolve()
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 400) {
        try {
          const errorBody = JSON.parse(xhr.responseText) as { error?: string }
          callbacks.onError(errorBody.error ?? `HTTP ${xhr.status}`)
        } catch {
          callbacks.onError(`HTTP ${xhr.status}`)
        }
        resolve()
        return
      }

      // Process any remaining buffer
      if (buffer.length > 0) {
        const result = processSSEBuffer(buffer + '\n', callbacks)
        if (!result.finished) {
          callbacks.onError('Stream ended unexpectedly')
        }
      }
      resolve()
    }

    xhr.onerror = () => {
      callbacks.onError('Network error')
      resolve()
    }

    xhr.ontimeout = () => {
      callbacks.onError('Request timed out')
      resolve()
    }

    // Handle abort signal
    if (signal) {
      signal.addEventListener('abort', () => {
        xhr.abort()
        resolve()
      })
    }

    xhr.send(JSON.stringify({ content }))
  })
}
