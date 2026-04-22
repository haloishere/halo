import { describe, it, expect } from 'vitest'
import { ld, vi, str, grpcWebFrame } from '../proto.js'

describe('str', () => {
  it('encodes a string as UTF-8 bytes', () => {
    const bytes = str('hello')
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(bytes.length).toBe(5)
    expect(bytes[0]).toBe(0x68) // 'h'
  })

  it('encodes an empty string as an empty array', () => {
    expect(str('').length).toBe(0)
  })
})

describe('vi (varint field)', () => {
  it('encodes a small integer with the correct field tag', () => {
    // field 1, wire type 0 (varint) → tag byte = (1 << 3) | 0 = 0x08
    const bytes = vi(1, 3)
    expect(bytes[0]).toBe(0x08)
    expect(bytes[1]).toBe(3)
  })
})

describe('ld (length-delimited field)', () => {
  it('prefixes data with the field tag and length varint', () => {
    const data = str('hi')
    const bytes = ld(2, data)
    // field 2, wire type 2 (length-delimited) → tag = (2 << 3) | 2 = 0x12
    expect(bytes[0]).toBe(0x12)
    expect(bytes[1]).toBe(2) // length = 2
    expect(bytes[2]).toBe(0x68) // 'h'
    expect(bytes[3]).toBe(0x69) // 'i'
  })

  it('handles empty data', () => {
    const bytes = ld(1, new Uint8Array(0))
    expect(bytes[1]).toBe(0) // length = 0
  })
})

describe('grpcWebFrame', () => {
  it('produces a 5-byte header followed by the body', () => {
    const body = str('payload')
    const frame = grpcWebFrame(body)
    expect(frame.length).toBe(5 + body.length)
    // First byte = 0 (no compression flag)
    expect(frame[0]).toBe(0)
    // Bytes 1-4 = big-endian uint32 of body length
    const view = new DataView(frame.buffer)
    expect(view.getUint32(1, false)).toBe(body.length)
  })

  it('encodes an empty body correctly', () => {
    const frame = grpcWebFrame(new Uint8Array(0))
    expect(frame.length).toBe(5)
    const view = new DataView(frame.buffer)
    expect(view.getUint32(1, false)).toBe(0)
  })
})
