import { describe, it, expect, vi } from 'vitest'
import { writeSSEHeaders, writeSSEChunk, writeSSEDone, writeSSEError } from '../sse.js'
import type { ServerResponse } from 'http'
import type { FastifyReply } from 'fastify'

function mockRaw() {
  return {
    writeHead: vi.fn(),
    write: vi.fn(),
    end: vi.fn(),
  } as unknown as ServerResponse
}

function mockReply(raw: ServerResponse) {
  return { raw } as unknown as FastifyReply
}

describe('writeSSEHeaders', () => {
  it('sets correct SSE headers', () => {
    const raw = mockRaw()
    const reply = mockReply(raw)

    writeSSEHeaders(reply)

    expect(raw.writeHead).toHaveBeenCalledWith(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })
  })
})

describe('writeSSEChunk', () => {
  it('writes event and data in SSE format', () => {
    const raw = mockRaw()

    writeSSEChunk(raw, 'message', { text: 'Hello' })

    expect(raw.write).toHaveBeenCalledWith('event: message\ndata: {"text":"Hello"}\n\n')
  })

  it('writes string data without JSON encoding', () => {
    const raw = mockRaw()

    writeSSEChunk(raw, 'message', 'plain text')

    expect(raw.write).toHaveBeenCalledWith('event: message\ndata: plain text\n\n')
  })
})

describe('writeSSEDone', () => {
  it('writes [DONE] and ends the response', () => {
    const raw = mockRaw()

    writeSSEDone(raw)

    expect(raw.write).toHaveBeenCalledWith('data: [DONE]\n\n')
    expect(raw.end).toHaveBeenCalled()
  })
})

describe('writeSSEError', () => {
  it('writes error event and ends the response', () => {
    const raw = mockRaw()

    writeSSEError(raw, { message: 'Something went wrong', code: 'INTERNAL' })

    expect(raw.write).toHaveBeenCalledWith(
      expect.stringContaining('event: error'),
    )
    expect(raw.write).toHaveBeenCalledWith(
      expect.stringContaining('Something went wrong'),
    )
    expect(raw.end).toHaveBeenCalled()
  })
})
