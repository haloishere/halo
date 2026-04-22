import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.setConfig({ testTimeout: 60_000 })

// ─── Hoisted mocks ──────────────────────────────────────────────────────────
// The picker imports both `useCreateConversation` (ai-chat) and
// `useVaultEntriesQuery` (vault), each of which loads `apiRequest` → `firebase.ts`.
// Firebase's `getReactNativePersistence` isn't safe to run in the vitest env.
// Stub both modules at the module boundary.
const mockMutateAsync = vi.fn()
const routerPushSpy = vi.fn()
const mockUseVaultEntriesQuery = vi.fn()

vi.mock('../../../../src/api/ai-chat', () => ({
  useCreateConversation: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
    isError: false,
  }),
}))

vi.mock('../../../../src/api/vault', () => ({
  useVaultEntriesQuery: ({ topic }: { topic: string }) => mockUseVaultEntriesQuery(topic),
}))

vi.mock('expo-router', () => ({
  router: {
    push: (href: string) => routerPushSpy(href),
    replace: vi.fn(),
  },
  useLocalSearchParams: () => ({}),
}))

// Tamagui lucide icons need a theme context; stub them to plain Text to keep
// the picker render lightweight (same pattern as TabBar.test.tsx).
vi.mock('@tamagui/lucide-icons', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- vi.mock factory must use require
  const { Text } = require('react-native')
  return {
    Utensils: (props: Record<string, unknown>) => <Text testID="icon-utensils" {...props} />,
    ShoppingBag: (props: Record<string, unknown>) => <Text testID="icon-shoppingbag" {...props} />,
    Sparkles: (props: Record<string, unknown>) => <Text testID="icon-sparkles" {...props} />,
  }
})

import { render, fireEvent, act } from '../../../../src/test/render'
import ScenariosPicker from '../index'

// Non-empty vault stub — makes the picker take the "create conversation" path.
const NON_EMPTY_VAULT = { data: [{ id: 'entry-1' }], isLoading: false, isError: false }
// Empty vault stub — makes the picker route to the questionnaire.
const EMPTY_VAULT = { data: [], isLoading: false, isError: false }

beforeEach(() => {
  mockMutateAsync.mockReset()
  routerPushSpy.mockReset()
  // Default: all three topics have existing vault entries → direct to chat.
  mockUseVaultEntriesQuery.mockReturnValue(NON_EMPTY_VAULT)
})

describe('ScenariosPicker — rendering', () => {
  it('renders all three scenario cards', () => {
    const { getByText } = render(<ScenariosPicker />)
    expect(getByText('Food & Restaurants')).toBeTruthy()
    expect(getByText('Fashion')).toBeTruthy()
    expect(getByText('Lifestyle & Travel')).toBeTruthy()
  })

  it('shows the header prompt', () => {
    const { getByText } = render(<ScenariosPicker />)
    expect(getByText('Pick a scenario')).toBeTruthy()
  })
})

describe('ScenariosPicker — non-empty vault → create conversation → navigate', () => {
  it('tapping Food creates a conversation with topic food_and_restaurants and pushes to /ai-chat/<id>', async () => {
    mockMutateAsync.mockResolvedValueOnce({
      id: 'conv-food-1',
      userId: 'u',
      title: null,
      summary: null,
      topic: 'food_and_restaurants',
      createdAt: '2026-04-21T10:00:00.000Z',
      updatedAt: '2026-04-21T10:00:00.000Z',
    })

    const { getByLabelText } = render(<ScenariosPicker />)

    await act(async () => {
      fireEvent.press(getByLabelText('Food & Restaurants scenario'))
      // Let the mutation promise resolve.
      await Promise.resolve()
    })

    expect(mockMutateAsync).toHaveBeenCalledWith({ topic: 'food_and_restaurants' })
    expect(routerPushSpy).toHaveBeenCalledWith('/ai-chat/conv-food-1')
  })

  it('tapping Fashion uses topic fashion', async () => {
    mockMutateAsync.mockResolvedValueOnce({
      id: 'conv-fashion-1',
      userId: 'u',
      title: null,
      summary: null,
      topic: 'fashion',
      createdAt: '2026-04-21T10:00:00.000Z',
      updatedAt: '2026-04-21T10:00:00.000Z',
    })

    const { getByLabelText } = render(<ScenariosPicker />)
    await act(async () => {
      fireEvent.press(getByLabelText('Fashion scenario'))
      await Promise.resolve()
    })

    expect(mockMutateAsync).toHaveBeenCalledWith({ topic: 'fashion' })
    expect(routerPushSpy).toHaveBeenCalledWith('/ai-chat/conv-fashion-1')
  })

  it('does not navigate when the create mutation fails', async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error('API down'))

    const { getByLabelText } = render(<ScenariosPicker />)
    await act(async () => {
      fireEvent.press(getByLabelText('Lifestyle & Travel scenario'))
      await Promise.resolve()
    })

    expect(mockMutateAsync).toHaveBeenCalled()
    expect(routerPushSpy).not.toHaveBeenCalled()
  })
})

describe('ScenariosPicker — empty vault → questionnaire routing', () => {
  it('routes to questionnaire when vault is empty for the tapped topic', async () => {
    mockUseVaultEntriesQuery.mockReturnValue(EMPTY_VAULT)

    const { getByLabelText } = render(<ScenariosPicker />)
    await act(async () => {
      fireEvent.press(getByLabelText('Food & Restaurants scenario'))
      await Promise.resolve()
    })

    expect(routerPushSpy).toHaveBeenCalledWith('/questionnaire/food_and_restaurants')
    expect(mockMutateAsync).not.toHaveBeenCalled()
  })

  it('does NOT navigate while vault is still loading (isLoading guard)', async () => {
    mockUseVaultEntriesQuery.mockReturnValue({ data: undefined, isLoading: true, isError: false })

    const { getByLabelText } = render(<ScenariosPicker />)
    await act(async () => {
      fireEvent.press(getByLabelText('Fashion scenario'))
      await Promise.resolve()
    })

    // isLoading: true → guard skips both the questionnaire push and conversation create
    expect(routerPushSpy).not.toHaveBeenCalled()
    expect(mockMutateAsync).not.toHaveBeenCalled()
  })
})
