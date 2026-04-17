/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, fireEvent } from '@testing-library/react-native'
import { render } from '../../../../src/test/render'
import { mockConversation, mockRouter } from '../../../../src/test/fixtures/chat'
import { NEW_CHAT_SENTINEL } from '../../../../src/lib/chat-resume'

// Cold-start RNTL + Tamagui hydration takes ~20s on the first render of this
// file. Same ceiling as the other chat screen test suites.
vi.setConfig({ testTimeout: 60_000 })

// Mutable ref for `useChatStore.getState().activeConversationId` so
// individual tests can simulate which conversation is currently open behind
// the history screen in the nested stack.
const { activeChatIdRef } = vi.hoisted(() => ({
  activeChatIdRef: { current: null as string | null },
}))

vi.mock('../../../../src/stores/chat', () => ({
  useChatStore: Object.assign(() => null, {
    getState: () => ({ activeConversationId: activeChatIdRef.current }),
  }),
}))

// ─── Hoisted captures ──────────────────────────────────────────────────────
// `convListProps` captures the props that history.tsx passes to
// ConversationList so the test can invoke onSelect / onDelete / onCreateNew
// and assert on the resulting handlers (router.push, createConversation
// mutate, delete mutate, etc.) WITHOUT rendering the real list component.
//
// `dialogProps` captures the props passed to ConfirmDialog so the test can
// assert it opens with the right state and drive its onConfirm callback.
const { convListProps, dialogProps } = vi.hoisted(() => ({
  convListProps: { current: null as any },
  dialogProps: { current: null as any },
}))

// ─── Mocks ─────────────────────────────────────────────────────────────────

const router = mockRouter()

// `navigation.reset` spy — history uses `useNavigation` + `reset` to fully
// wipe the nested stack when the user picks or creates a chat, so hardware
// back from the newly-opened chat returns to the previous tab (home)
// instead of popping through history.
const navigationReset = vi.fn()

vi.mock('expo-router', () => ({
  useRouter: () => router,
  useNavigation: () => ({
    reset: navigationReset,
    getParent: () => null,
  }),
  Stack: { Screen: () => null },
}))

// react-query hooks — the history screen destructures the full shape from
// `useConversationsQuery()`, so return a shape that matches its infinite-
// query contract.
const mockUseConversationsQuery = vi.fn()
const createConversationMutate = vi.fn()
const deleteConversationMutate = vi.fn()

vi.mock('../../../../src/api/ai-chat', () => ({
  useConversationsQuery: () => mockUseConversationsQuery(),
  useCreateConversation: () => ({
    mutate: createConversationMutate,
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useDeleteConversation: () => ({
    mutate: deleteConversationMutate,
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}))

// Mock ConversationList as a prop-capturing stub. The real component is
// tested in its own ConversationList.test.tsx — here we only care about
// what handlers history.tsx wires into it.
vi.mock('../../../../src/components/chat/ConversationList', () => ({
  ConversationList: (props: Record<string, unknown>) => {
    convListProps.current = props
    return null
  },
}))

// Mock the UI barrel so the test can drive ConfirmDialog's onConfirm
// directly without fighting Tamagui dialog internals. Importing the real
// module would pull in react-native-web via other Tamagui components in
// the barrel (which crashes on `ShadowRoot is not defined` in the Node
// test env), so we list ONLY the exports history.tsx actually uses.
vi.mock('../../../../src/components/ui', () => ({
  ConfirmDialog: (props: Record<string, unknown>) => {
    dialogProps.current = props
    return null
  },
  AnimatedScreen: ({ children }: { children: React.ReactNode }) => children,
}))

// Mock HeaderBar as a passthrough that records its props (to assert
// showBack + title wiring).
const headerBarProps = { current: null as any }
vi.mock('../../../../src/components/ui/HeaderBar', () => ({
  HeaderBar: (props: Record<string, unknown>) => {
    headerBarProps.current = props
    return null
  },
}))

// Mock the lucide icon used by the FAB. The real icon pulls in
// @tamagui/helpers-icon → useTheme → "Missing theme" in the Node test
// env. The icon's only purpose in this test is to be a leaf inside the
// FAB button; rendering it as a no-op keeps the Tamagui render tree
// happy without losing any assertion surface.
vi.mock('@tamagui/lucide-icons', () => ({
  Plus: () => null,
}))

// Toast controller — the global test setup already provides a no-op stub
// for `@tamagui/toast` (see src/test/setup.ts). That stub is sufficient
// here: we don't need to assert toast copy in this screen test; the
// delete flow is verified via the `useDeleteConversation.mutate` spy.

// Static import after mocks are hoisted.
import HistoryScreen from '../history'

// ─── Helpers ───────────────────────────────────────────────────────────────

function primeQuery(
  options: {
    conversations?: Array<ReturnType<typeof mockConversation>>
    isLoading?: boolean
    isRefetching?: boolean
    isError?: boolean
    hasNextPage?: boolean
    refetch?: ReturnType<typeof vi.fn>
    fetchNextPage?: ReturnType<typeof vi.fn>
  } = {},
) {
  const {
    conversations = [],
    isLoading = false,
    isRefetching = false,
    isError = false,
    hasNextPage = false,
    refetch = vi.fn(),
    fetchNextPage = vi.fn(),
  } = options
  mockUseConversationsQuery.mockReturnValue({
    data: isLoading || isError ? undefined : { pages: [{ conversations, nextCursor: null }] },
    isLoading,
    isRefetching,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
  })
}

// ─── Setup / teardown ──────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  convListProps.current = null
  dialogProps.current = null
  headerBarProps.current = null
  activeChatIdRef.current = null
})

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('HistoryScreen — header', () => {
  it('renders HeaderBar with showBack and "Chat History" title', () => {
    primeQuery()
    render(<HistoryScreen />)
    expect(headerBarProps.current).toEqual(
      expect.objectContaining({ showBack: true, title: 'Chat History' }),
    )
  })
})

describe('HistoryScreen — list wiring', () => {
  it('passes conversations, loading, refreshing, and hasMore flags to ConversationList', () => {
    const conversations = [
      mockConversation({ id: 'c1', title: 'First chat' }),
      mockConversation({ id: 'c2', title: 'Second chat' }),
    ]
    primeQuery({ conversations, isRefetching: true, hasNextPage: true })

    render(<HistoryScreen />)

    expect(convListProps.current).not.toBeNull()
    expect(convListProps.current.conversations).toEqual(conversations)
    expect(convListProps.current.isLoading).toBe(false)
    expect(convListProps.current.isRefreshing).toBe(true)
    expect(convListProps.current.hasMore).toBe(true)
  })

  it('flattens pages from useConversationsQuery (infinite-query shape)', () => {
    mockUseConversationsQuery.mockReturnValue({
      data: {
        pages: [
          { conversations: [mockConversation({ id: 'a' })], nextCursor: 'cur' },
          { conversations: [mockConversation({ id: 'b' })], nextCursor: null },
        ],
      },
      isLoading: false,
      isRefetching: false,
      refetch: vi.fn(),
      fetchNextPage: vi.fn(),
      hasNextPage: false,
    })

    render(<HistoryScreen />)

    expect(convListProps.current.conversations.map((c: { id: string }) => c.id)).toEqual(['a', 'b'])
  })
})

describe('HistoryScreen — navigation semantics', () => {
  it('row tap RESETS the nested stack to a single [id] entry (not push, not replace)', () => {
    // Regression lock for the back-navigation bug: hardware back from
    // a chat picked in history must return to the previously-focused
    // tab (home), NOT to the chat the user was on before opening
    // history, AND NOT bounce back through the history list.
    //
    // - `push`       → stack becomes [prev, history, newId] → 2-hop back
    // - `replace`    → stack becomes [prev, newId]          → back goes to prev
    // - `reset [id]` → stack becomes [newId]                → back exits tab ✓
    //
    // Only the full `navigation.reset` satisfies the "back exits the
    // chat tab entirely" requirement.
    primeQuery({ conversations: [mockConversation({ id: 'target-id' })] })
    render(<HistoryScreen />)

    act(() => {
      convListProps.current.onSelect('target-id')
    })

    expect(navigationReset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: '[id]', params: { id: 'target-id' } }],
    })
    expect(router.replace).not.toHaveBeenCalled()
    expect(router.push).not.toHaveBeenCalled()
  })

  it('FAB "new chat" resets the nested stack to a single [id=new] entry (Path B)', () => {
    // CRITICAL architectural invariant: the FAB must route to the
    // sentinel — lazy creation happens downstream in useAiChat's
    // sendMessage, NOT here. Same full-reset semantics as
    // `handleSelect` above so back from the new chat skips both
    // history AND any previous chat in the stack.
    primeQuery({ conversations: [mockConversation({ id: 'existing' })] })
    render(<HistoryScreen />)

    act(() => {
      convListProps.current.onCreateNew()
    })

    expect(navigationReset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: '[id]', params: { id: 'new' } }],
    })
    expect(createConversationMutate).not.toHaveBeenCalled()
  })

  it('empty-state "new chat" button ALSO resets the stack to [id=new]', () => {
    primeQuery({ conversations: [] })
    render(<HistoryScreen />)

    act(() => {
      convListProps.current.onCreateNew()
    })

    expect(navigationReset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: '[id]', params: { id: 'new' } }],
    })
    expect(createConversationMutate).not.toHaveBeenCalled()
  })
})

describe('HistoryScreen — delete flow', () => {
  it('onDelete opens ConfirmDialog with the pending id but does NOT mutate yet', () => {
    primeQuery({ conversations: [mockConversation({ id: 'to-delete' })] })
    render(<HistoryScreen />)

    expect(dialogProps.current.open).toBe(false)

    act(() => {
      convListProps.current.onDelete('to-delete')
    })

    expect(dialogProps.current.open).toBe(true)
    expect(deleteConversationMutate).not.toHaveBeenCalled()
  })

  it('confirming the dialog fires useDeleteConversation.mutate with the pending id', () => {
    primeQuery({ conversations: [mockConversation({ id: 'to-delete' })] })
    render(<HistoryScreen />)

    act(() => {
      convListProps.current.onDelete('to-delete')
    })
    act(() => {
      dialogProps.current.onConfirm()
    })

    expect(deleteConversationMutate).toHaveBeenCalledWith('to-delete', expect.any(Object))
  })

  it('resets stack to new chat when the deleted conversation is the currently active one', () => {
    // Regression lock for: "go to history, delete current chat, press back
    // → still see old messages".
    //
    // The fix: onSuccess checks useChatStore.getState().activeConversationId.
    // If it matches the deleted id, handleCreateNew() resets the nested
    // stack to [id=new] immediately — no waiting for a background 404.
    activeChatIdRef.current = 'active-chat-id'
    primeQuery({ conversations: [mockConversation({ id: 'active-chat-id' })] })
    render(<HistoryScreen />)

    act(() => { convListProps.current.onDelete('active-chat-id') })

    // Make the mutation call onSuccess synchronously so we can assert
    // the navigation without a real network round-trip.
    deleteConversationMutate.mockImplementationOnce(
      (_id: string, callbacks?: { onSuccess?: () => void }) => callbacks?.onSuccess?.(),
    )
    act(() => { dialogProps.current.onConfirm() })

    expect(navigationReset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: '[id]', params: { id: NEW_CHAT_SENTINEL } }],
    })
  })

  it('does NOT reset the stack when a different (non-active) conversation is deleted', () => {
    // Deleting a conversation OTHER than the one currently open should
    // not disrupt the stack — the user stays in history and can press
    // back normally to their active chat.
    activeChatIdRef.current = 'some-other-chat-id'
    primeQuery({ conversations: [mockConversation({ id: 'to-delete' })] })
    render(<HistoryScreen />)

    act(() => { convListProps.current.onDelete('to-delete') })

    deleteConversationMutate.mockImplementationOnce(
      (_id: string, callbacks?: { onSuccess?: () => void }) => callbacks?.onSuccess?.(),
    )
    act(() => { dialogProps.current.onConfirm() })

    expect(navigationReset).not.toHaveBeenCalled()
  })

  it('dismissing the dialog (onOpenChange=false) clears pending id without mutating', () => {
    primeQuery({ conversations: [mockConversation({ id: 'to-delete' })] })
    render(<HistoryScreen />)

    act(() => {
      convListProps.current.onDelete('to-delete')
    })
    expect(dialogProps.current.open).toBe(true)

    act(() => {
      dialogProps.current.onOpenChange(false)
    })

    expect(dialogProps.current.open).toBe(false)
    expect(deleteConversationMutate).not.toHaveBeenCalled()
  })
})

describe('HistoryScreen — query wiring', () => {
  it('onRefresh prop on ConversationList is the refetch function from useConversationsQuery', () => {
    // Regression lock: if a typo like `onRefresh={refetchNext}` ever
    // replaces `onRefresh={refetch}`, the pull-to-refresh gesture would
    // silently call the wrong function. Assert the forwarded reference
    // fires the exact refetch spy we primed.
    const refetchSpy = vi.fn()
    primeQuery({
      conversations: [mockConversation({ id: 'c1' })],
      refetch: refetchSpy,
    })
    render(<HistoryScreen />)

    act(() => {
      convListProps.current.onRefresh()
    })

    expect(refetchSpy).toHaveBeenCalledTimes(1)
  })

  it('onLoadMore prop on ConversationList calls fetchNextPage', () => {
    // Regression lock: pagination is invisible to a screen test because
    // onLoadMore is called by FlatList's onEndReached, not a direct tap.
    // A refactor swapping fetchNextPage for refetch would not be caught
    // by any user-facing test without this lock.
    const fetchNextPageSpy = vi.fn()
    primeQuery({
      conversations: [mockConversation({ id: 'c1' })],
      hasNextPage: true,
      fetchNextPage: fetchNextPageSpy,
    })
    render(<HistoryScreen />)

    act(() => {
      convListProps.current.onLoadMore?.()
    })

    expect(fetchNextPageSpy).toHaveBeenCalledTimes(1)
  })
})

describe('HistoryScreen — error state', () => {
  it('renders an error UI with retry button when the list query fails', () => {
    const refetchSpy = vi.fn()
    primeQuery({ isError: true, refetch: refetchSpy })

    const { getByText, getAllByText } = render(<HistoryScreen />)

    // Error headline + body copy matches the (tabs)/ai-chat.tsx loader
    // error state for consistency across chat screens.
    expect(getByText(/something went wrong/i)).toBeTruthy()
    // Button renders both the child text AND an accessibilityLabel of
    // "Try again", so getAllByText returns >=1.
    expect(getAllByText(/try again/i).length).toBeGreaterThanOrEqual(1)

    // Error state must NOT have rendered ConversationList — the spinner
    // + empty state would contradict the retry affordance.
    expect(convListProps.current).toBeNull()
  })

  it('pressing "Try again" on the error state calls refetch', () => {
    // Regression lock for the retry-button wiring. Without this, a
    // refactor could leave the button visible but non-functional.
    const refetchSpy = vi.fn()
    primeQuery({ isError: true, refetch: refetchSpy })

    const { getByLabelText } = render(<HistoryScreen />)

    fireEvent.press(getByLabelText('Try again'))

    expect(refetchSpy).toHaveBeenCalledTimes(1)
  })
})
