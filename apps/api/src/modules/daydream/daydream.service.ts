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

// Errors originating from the Daydream external service (BFF / Liaison HTTP
// failures, JWT retry exhaustion). These are expected failure modes and justify
// returning an empty product list so the conversation can continue.
const EXTERNAL_SERVICE_PREFIXES = [
  'BFF send failed:',
  'Liaison list failed:',
  'grpc-status=',
  'gRPC UNAUTHENTICATED:',
  'No UUID found in BFF response',
  'BFF response contained no UUID distinct from',
]

function isExternalServiceError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  return EXTERNAL_SERVICE_PREFIXES.some((prefix) => err.message.startsWith(prefix))
}

export async function searchDaydream(
  query: string,
  opts: DaydreamSearchOptions,
): Promise<DaydreamProduct[]> {
  const start = Date.now()
  const queryHash = createHash('sha256').update(query).digest('hex')

  try {
    const result = await search(query)

    const parsed = result.products.map((p) => ({ raw: p, result: daydreamProductSchema.safeParse(p) }))
    const failed = parsed.filter((x) => !x.result.success)
    if (failed.length > 0) {
      opts.logger?.warn(
        {
          dropped: failed.length,
          total: result.products.length,
        },
        'searchDaydream: products dropped due to schema validation failure — Daydream API may have changed',
      )
    }
    const products = parsed
      .filter((x): x is { raw: typeof x.raw; result: { success: true; data: DaydreamProduct } } => x.result.success)
      .map((x) => x.result.data)

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
    opts.logger?.error({ err }, 'searchDaydream: search failed')

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

    if (isExternalServiceError(err)) {
      return []
    }

    // Infrastructure failures (Secret Manager IAM, env misconfiguration, JSON
    // parse errors) propagate so the route handler returns 500 and Sentry fires.
    throw err
  }
}
