import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, waitFor } from '@testing-library/react-native'
import { renderHookWithProviders } from '../../test/renderWithProviders'

vi.mock('../client', () => ({
  apiRequest: vi.fn(),
}))

import { apiRequest } from '../client'
import {
  useConversationsQuery,
  useConversationQuery,
  useCreateConversation,
  useDeleteConversation,
  useSubmitFeedback,
} from '../ai-chat'

const mockApiRequest = vi.mocked(apiRequest)

beforeEach(() => {
  mockApiRequest.mockReset()
})

describe('useConversationsQuery', () => {
  it('fetches conversations list', async () => {
    const conversations = [
      {
        id: '1',
        userId: 'u1',
        title: 'Chat 1',
        summary: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    ]
    mockApiRequest.mockResolvedValueOnce({
      success: true,
      data: conversations,
      meta: { total: 1, page: 1, limit: 20, cursor: undefined },
    })

    const { result } = renderHookWithProviders(() => useConversationsQuery())

    await waitFor(() => expect(result.current.data?.pages).toHaveLength(1))
    expect(result.current.data?.pages[0]?.conversations).toEqual(conversations)
  })
})

describe('useConversationQuery', () => {
  it('fetches single conversation with messages', async () => {
    const conversation = {
      id: '1',
      userId: 'u1',
      title: 'Chat 1',
      summary: null,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      messages: [],
    }
    mockApiRequest.mockResolvedValueOnce({ success: true, data: conversation })

    const { result } = renderHookWithProviders(() => useConversationQuery('1'))

    await waitFor(() => expect(result.current.data).toEqual(conversation))
  })

  it('does not fetch when conversationId is null', () => {
    const { result } = renderHookWithProviders(() => useConversationQuery(null))

    expect(result.current.fetchStatus).toBe('idle')
    expect(mockApiRequest).not.toHaveBeenCalled()
  })
})

describe('useCreateConversation', () => {
  it('creates a new conversation', async () => {
    const newConv = {
      id: '2',
      userId: 'u1',
      title: 'New Chat',
      summary: null,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    }
    mockApiRequest.mockResolvedValueOnce({ success: true, data: newConv })

    const { result } = renderHookWithProviders(() => useCreateConversation())

    await act(async () => {
      result.current.mutate({ title: 'New Chat' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockApiRequest).toHaveBeenCalledWith('/v1/ai/conversations', {
      method: 'POST',
      body: JSON.stringify({ title: 'New Chat' }),
    })
  })
})

describe('useDeleteConversation', () => {
  it('deletes a conversation', async () => {
    mockApiRequest.mockResolvedValueOnce({ success: true, data: null })

    const { result } = renderHookWithProviders(() => useDeleteConversation())

    await act(async () => {
      result.current.mutate('conv-1')
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockApiRequest).toHaveBeenCalledWith('/v1/ai/conversations/conv-1', {
      method: 'DELETE',
    })
  })

  it('removes the individual conversation cache entry on success', async () => {
    // Regression lock: onSuccess must call removeQueries for the specific
    // conversation key so the still-mounted chat screen's useConversationQuery
    // immediately refetches (getting a 404) instead of serving stale cached
    // messages to the user after they navigated away via the history screen.
    mockApiRequest.mockResolvedValueOnce({ success: true, data: null })

    const { result, queryClient } = renderHookWithProviders(() => useDeleteConversation())

    // Seed the cache to simulate the chat screen having loaded the conversation.
    queryClient.setQueryData(['ai', 'conversations', 'conv-1'], {
      id: 'conv-1',
      messages: [{ id: 'm1', role: 'user', content: 'hello' }],
    })
    expect(queryClient.getQueryData(['ai', 'conversations', 'conv-1'])).toBeTruthy()

    await act(async () => {
      result.current.mutate('conv-1')
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(queryClient.getQueryData(['ai', 'conversations', 'conv-1'])).toBeUndefined()
  })
})

describe('useSubmitFeedback', () => {
  it('submits feedback for a message', async () => {
    const updatedMsg = { id: 'msg-1', feedbackRating: 'thumbs_up' }
    mockApiRequest.mockResolvedValueOnce({ success: true, data: updatedMsg })

    const { result } = renderHookWithProviders(() => useSubmitFeedback())

    await act(async () => {
      result.current.mutate({
        conversationId: 'conv-1',
        messageId: 'msg-1',
        data: { rating: 'thumbs_up' },
      })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})

describe('useCreateConversation — error path', () => {
  it('throws when API returns failure', async () => {
    mockApiRequest.mockResolvedValueOnce({ success: false, error: 'Rate limited' })

    const { result } = renderHookWithProviders(() => useCreateConversation())

    await act(async () => {
      result.current.mutate({ title: 'New Chat' })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('Rate limited')
  })
})

describe('useDeleteConversation — error path', () => {
  it('throws when API returns failure', async () => {
    mockApiRequest.mockResolvedValueOnce({ success: false, error: 'Not found' })

    const { result } = renderHookWithProviders(() => useDeleteConversation())

    await act(async () => {
      result.current.mutate('conv-999')
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('Not found')
  })
})
