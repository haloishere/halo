/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '../../../../src/test/render'
import { useLastChatStore } from '../../../../src/stores/last-chat'
import { NEW_CHAT_SENTINEL } from '../../../../src/lib/chat-resume'

vi.setConfig({ testTimeout: 60_000 })

// ─── Redirect prop-capturing stub ─────────────────────────────────────────
// expo-router's <Redirect /> is a navigation directive, not a visible
// component. Test it at the prop-shape level: capture the href the tab
// component passes, assert it against the 2h decision rules.
const redirectProps: { current: Record<string, unknown> | null } = { current: null }

vi.mock('expo-router', () => ({
  Redirect: (props: Record<string, unknown>) => {
    redirectProps.current = props
    return null
  },
}))

// Static import after hoisted mocks.
import AiChatScreen from '../index'

const FROZEN_NOW = new Date('2026-05-15T12:00:00Z')
const ONE_HOUR_MS = 60 * 60 * 1000
const TWO_HOURS_MS = 2 * ONE_HOUR_MS
const THREE_HOURS_MS = 3 * ONE_HOUR_MS

beforeEach(() => {
  vi.clearAllMocks()
  redirectProps.current = null
  // Reset persisted last-chat state between tests — zustand/persist's
  // in-memory copy leaks across tests otherwise.
  useLastChatStore.setState({ lastChatId: null, lastChatUpdatedAt: null }, false)
  vi.useFakeTimers()
  vi.setSystemTime(FROZEN_NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('AiChatScreen — Redirect target from persisted last-chat state', () => {
  it('redirects to /ai-chat/new when there is no persisted lastChatId (first launch)', () => {
    render(<AiChatScreen />)
    expect(redirectProps.current).not.toBeNull()
    expect(redirectProps.current?.href).toBe(`/ai-chat/${NEW_CHAT_SENTINEL}`)
  })

  it('redirects to /chat/{lastChatId} when the persisted timestamp is within 2h', () => {
    useLastChatStore.setState({
      lastChatId: 'recent-conv',
      lastChatUpdatedAt: FROZEN_NOW.getTime() - ONE_HOUR_MS,
    })

    render(<AiChatScreen />)

    expect(redirectProps.current?.href).toBe('/ai-chat/recent-conv')
  })

  it('redirects to /ai-chat/new when the persisted timestamp is older than 2h (stale)', () => {
    useLastChatStore.setState({
      lastChatId: 'stale-conv',
      lastChatUpdatedAt: FROZEN_NOW.getTime() - THREE_HOURS_MS,
    })

    render(<AiChatScreen />)

    expect(redirectProps.current?.href).toBe(`/ai-chat/${NEW_CHAT_SENTINEL}`)
  })

  it('redirects to /ai-chat/new at exactly the 2h boundary (strict `<`, not `<=`)', () => {
    // Regression lock mirrors `shouldResumeTimestamp` boundary.
    useLastChatStore.setState({
      lastChatId: 'boundary-conv',
      lastChatUpdatedAt: FROZEN_NOW.getTime() - TWO_HOURS_MS,
    })

    render(<AiChatScreen />)

    expect(redirectProps.current?.href).toBe(`/ai-chat/${NEW_CHAT_SENTINEL}`)
  })

  it('redirects to /ai-chat/new when lastChatId is set but the timestamp is null (corrupted persist)', () => {
    // Defensive: if the persisted blob is half-populated (e.g. shape
    // changed between versions), fall through to the new-chat sentinel
    // rather than dropping the user into a chat with no age info.
    useLastChatStore.setState({
      lastChatId: 'orphan',
      lastChatUpdatedAt: null,
    })

    render(<AiChatScreen />)

    expect(redirectProps.current?.href).toBe(`/ai-chat/${NEW_CHAT_SENTINEL}`)
  })
})
