import type { VaultTopic } from '@halo/shared'
import type { DaydreamProduct } from '@halo/shared'
import type { AiFunctionDeclaration } from '../../lib/vertex-ai.js'
import type { DrizzleDb } from '../../db/types.js'
import type { FastifyBaseLogger } from 'fastify'
import { searchDaydream } from '../daydream/daydream.service.js'

export interface ToolDispatchOpts {
  db: DrizzleDb
  userId: string
  conversationId: string
  logger?: FastifyBaseLogger
}

export interface ToolCallResult {
  products: DaydreamProduct[]
  functionResponse: {
    name: string
    response: Record<string, unknown>
  }
}

export interface GeminiToolDeclaration {
  functionDeclarations: AiFunctionDeclaration[]
}

export function buildDaydreamToolDeclaration(): GeminiToolDeclaration {
  return {
    functionDeclarations: [
      {
        name: 'daydream_search',
        description:
          "Search Daydream for shoppable fashion products matching the user's query. " +
          'Call this only when the user explicitly wants to browse or buy products.',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description:
                'A concise product search query (e.g. "brown chelsea boots under 200 euros").',
            },
          },
          required: ['query'],
        },
      },
    ],
  }
}

// Only expose the daydream_search tool for fashion conversations.
// Food and Lifestyle topics get no tools — Gemini answers from memory context only.
export function buildTools(topic: VaultTopic): GeminiToolDeclaration[] {
  if (topic === 'fashion') {
    return [buildDaydreamToolDeclaration()]
  }
  return []
}

export async function dispatchToolCall(
  call: { name: string; args: Record<string, unknown> },
  opts: ToolDispatchOpts,
): Promise<ToolCallResult> {
  if (call.name === 'daydream_search') {
    if (typeof call.args.query !== 'string' || !call.args.query) {
      throw new Error(`daydream_search: query argument missing or non-string`)
    }
    const products = await searchDaydream(call.args.query, opts)
    return {
      products,
      functionResponse: {
        name: 'daydream_search',
        response: { products },
      },
    }
  }

  throw new Error(`Unknown tool: ${call.name}`)
}
