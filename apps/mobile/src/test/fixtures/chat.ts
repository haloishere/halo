/**
 * Shared test fixtures for chat-related screens and hooks.
 *
 * Used by:
 * - `app/(tabs)/__tests__/ai-chat.test.tsx` — loader screen tests
 * - `app/chat/__tests__/history.test.tsx` — history screen tests (PR 5)
 * - `app/chat/__tests__/[id].test.tsx` — chat detail tests (PR 6)
 *
 * Keeps the mocks for `AiConversation`, the expo-router API surface, and
 * the chat-store shape in one place so the three screen test suites stay
 * in sync when any of those shapes change.
 */

import { vi } from 'vitest'
import type { AiConversation } from '@halo/shared'

/**
 * Factory for a well-formed `AiConversation`. Every field has a sensible
 * default — tests override only what matters to the assertion at hand.
 *
 * ```ts
 * const fresh = mockConversation({ updatedAt: oneHourAgo().toISOString() })
 * const stale = mockConversation({ updatedAt: threeHoursAgo().toISOString() })
 * ```
 */
export function mockConversation(overrides: Partial<AiConversation> = {}): AiConversation {
  return {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    userId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    title: 'Test Conversation',
    summary: null,
    createdAt: '2026-05-15T10:00:00.000Z',
    updatedAt: '2026-05-15T10:00:00.000Z',
    ...overrides,
  }
}

/**
 * Convenience: returns an ISO timestamp `msAgo` milliseconds before `now`.
 * Use this to place seed conversations at specific offsets for 2h-boundary
 * tests without doing wall-clock math inline.
 */
export function isoAgo(now: Date, msAgo: number): string {
  return new Date(now.getTime() - msAgo).toISOString()
}

/**
 * Mock `expo-router` navigation API. The three methods returned are
 * `vi.fn()` spies that tests can assert on (`mockRouter.replace.mock.calls`,
 * etc.). Hand-rolled rather than auto-mocked so the test can read the
 * spies back after rendering.
 */
export function mockRouter(): {
  push: ReturnType<typeof vi.fn>
  replace: ReturnType<typeof vi.fn>
  back: ReturnType<typeof vi.fn>
} {
  return {
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }
}
