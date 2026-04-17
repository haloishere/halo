import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '../../test/render'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

const { mockSignInWithGoogle } = vi.hoisted(() => ({
  mockSignInWithGoogle: vi.fn(),
}))

vi.mock('../../lib/google-auth', () => ({
  signInWithGoogle: mockSignInWithGoogle,
}))

import { useGoogleSignInMutation } from '../google-auth'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useGoogleSignInMutation', () => {
  it('calls signInWithGoogle()', async () => {
    mockSignInWithGoogle.mockResolvedValue({
      user: { uid: 'uid-1' },
    })

    const { result } = renderHook(() => useGoogleSignInMutation(), {
      wrapper: createWrapper(),
    })
    await waitFor(async () => {
      await result.current.mutateAsync()
    })

    expect(mockSignInWithGoogle).toHaveBeenCalled()
  })

  it('returns null without error when user cancels', async () => {
    mockSignInWithGoogle.mockResolvedValue(null)

    const { result } = renderHook(() => useGoogleSignInMutation(), {
      wrapper: createWrapper(),
    })

    let mutationResult: unknown
    await waitFor(async () => {
      mutationResult = await result.current.mutateAsync()
    })

    expect(mutationResult).toBeNull()
  })

  it('returns uid on successful sign-in', async () => {
    mockSignInWithGoogle.mockResolvedValue({
      user: { uid: 'uid-1' },
    })

    const { result } = renderHook(() => useGoogleSignInMutation(), {
      wrapper: createWrapper(),
    })

    let mutationResult: unknown
    await waitFor(async () => {
      mutationResult = await result.current.mutateAsync()
    })

    expect(mutationResult).toEqual({ uid: 'uid-1' })
  })

  it('propagates errors from signInWithGoogle', async () => {
    mockSignInWithGoogle.mockRejectedValue(new Error('Play services not available'))

    const { result } = renderHook(() => useGoogleSignInMutation(), {
      wrapper: createWrapper(),
    })

    let error: unknown
    try {
      await result.current.mutateAsync()
    } catch (err) {
      error = err
    }

    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toBe('Play services not available')
  })
})
