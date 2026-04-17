import { describe, it, expect } from 'vitest'
import { buildConversationContext } from '../context-builder.js'
import type { DbMessage } from '../context-builder.js'

function makeMessage(
  role: DbMessage['role'],
  content: string,
  minutesAgo: number = 0,
): DbMessage {
  return {
    role,
    content,
    createdAt: new Date(Date.now() - minutesAgo * 60_000),
  }
}

describe('buildConversationContext', () => {
  it('maps user role to user', () => {
    const result = buildConversationContext([makeMessage('user', 'Hello')])

    expect(result).toEqual([{ role: 'user', parts: [{ text: 'Hello' }] }])
  })

  it('maps assistant role to model', () => {
    const result = buildConversationContext([makeMessage('assistant', 'Hi there')])

    expect(result).toEqual([{ role: 'model', parts: [{ text: 'Hi there' }] }])
  })

  it('excludes system messages', () => {
    const messages = [
      makeMessage('system', 'System context'),
      makeMessage('user', 'Hello'),
      makeMessage('assistant', 'Hi'),
    ]

    const result = buildConversationContext(messages)

    expect(result).toHaveLength(2)
    expect(result[0]!.role).toBe('user')
    expect(result[1]!.role).toBe('model')
  })

  it('handles fewer than 20 messages', () => {
    const messages = [
      makeMessage('user', 'msg1'),
      makeMessage('assistant', 'msg2'),
      makeMessage('user', 'msg3'),
    ]

    const result = buildConversationContext(messages)

    expect(result).toHaveLength(3)
  })

  it('handles exactly 20 messages', () => {
    const messages = Array.from({ length: 20 }, (_, i) =>
      makeMessage(i % 2 === 0 ? 'user' : 'assistant', `msg${i}`),
    )

    const result = buildConversationContext(messages)

    expect(result).toHaveLength(20)
  })

  it('truncates to last 20 messages when more than 20', () => {
    const messages = Array.from({ length: 30 }, (_, i) =>
      makeMessage(i % 2 === 0 ? 'user' : 'assistant', `msg${i}`),
    )

    const result = buildConversationContext(messages)

    expect(result).toHaveLength(20)
    // Should contain the last 20 messages (msg10–msg29)
    expect(result[0]!.parts[0]!.text).toBe('msg10')
    expect(result[19]!.parts[0]!.text).toBe('msg29')
  })

  it('returns empty array for no messages', () => {
    const result = buildConversationContext([])

    expect(result).toEqual([])
  })

  it('preserves message order', () => {
    const messages = [
      makeMessage('user', 'first'),
      makeMessage('assistant', 'second'),
      makeMessage('user', 'third'),
    ]

    const result = buildConversationContext(messages)

    expect(result.map((r) => r.parts[0]!.text)).toEqual(['first', 'second', 'third'])
  })
})
