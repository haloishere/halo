import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.setConfig({ testTimeout: 60_000 })

// ─── Hoisted mocks ──────────────────────────────────────────────────────────
// The picker imports `useCreateConversation` which loads `apiRequest` which
// loads `firebase.ts` — Firebase's `getReactNativePersistence` isn't safe to
// run in the vitest env. Stub the mutation at the module boundary.
const mockMutateAsync = vi.fn()
const routerPushSpy = vi.fn()

vi.mock('../../../../src/api/ai-chat', () => ({
  useCreateConversation: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}))

vi.mock('expo-router', () => ({
  router: {
    push: (href: string) => routerPushSpy(href),
  },
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

beforeEach(() => {
  mockMutateAsync.mockReset()
  routerPushSpy.mockReset()
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

describe('ScenariosPicker — tap → create conversation → navigate', () => {
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
