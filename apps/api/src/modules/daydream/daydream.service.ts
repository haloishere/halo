import { createHash } from 'node:crypto'
import type { FastifyBaseLogger } from 'fastify'
import type { DrizzleDb } from '../../db/types.js'
import type { DaydreamProduct } from '@halo/shared'
import { daydreamProductSchema } from '@halo/shared'
import { writeAuditLog } from '../../lib/audit.js'
import { search } from './daydream.client.js'

export interface DaydreamSearchOptions {
  db: DrizzleDb
  userId: string
  conversationId: string
  logger?: FastifyBaseLogger
}

export async function searchDaydream(
  query: string,
  opts: DaydreamSearchOptions,
): Promise<DaydreamProduct[]> {
  const start = Date.now()
  const queryHash = createHash('sha256').update(query).digest('hex')

  try {
    const result = await search(query)
    const products = result.products
      .map((p) => daydreamProductSchema.safeParse(p))
      .filter((r): r is { success: true; data: DaydreamProduct } => r.success)
      .map((r) => r.data)

    void writeAuditLog(
      opts.db,
      {
        userId: opts.userId,
        action: 'ai.tool.call',
        resource: 'daydream_search',
        resourceId: opts.conversationId,
        metadata: {
          queryHash,
          productsReturned: products.length,
          latencyMs: Date.now() - start,
          outcome: 'ok',
        },
      },
      opts.logger,
    )

    return products
  } catch (err) {
    opts.logger?.warn({ err }, 'searchDaydream: search failed, returning empty list')

    void writeAuditLog(
      opts.db,
      {
        userId: opts.userId,
        action: 'ai.tool.call',
        resource: 'daydream_search',
        resourceId: opts.conversationId,
        metadata: {
          queryHash,
          productsReturned: 0,
          latencyMs: Date.now() - start,
          outcome: 'error',
          errorCode: err instanceof Error ? err.message.slice(0, 100) : 'unknown',
        },
      },
      opts.logger,
    )

    return []
  }
}
