import type { FastifyReply } from 'fastify'
import type { ServerResponse } from 'http'

export function writeSSEHeaders(reply: FastifyReply): void {
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // Hint for reverse proxies to disable response buffering
  })
}

export function writeSSEChunk(raw: ServerResponse, event: string, data: unknown): void {
  const payload = typeof data === 'string' ? data : JSON.stringify(data)
  raw.write(`event: ${event}\ndata: ${payload}\n\n`)
}

export function writeSSEDone(raw: ServerResponse): void {
  raw.write('data: [DONE]\n\n')
  raw.end()
}

export function writeSSEError(
  raw: ServerResponse,
  error: { message: string; code?: string },
): void {
  writeSSEChunk(raw, 'error', error)
  raw.end()
}
