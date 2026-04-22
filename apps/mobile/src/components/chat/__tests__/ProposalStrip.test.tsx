import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, act } from '../../../test/render'
import type { MemoryProposal } from '@halo/shared'

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mutateSpy, mutateResultRef } = vi.hoisted(() => {
  const mutateSpy = vi.fn()
  return {
    mutateSpy,
    // Controls what mutateAsync resolves/rejects with per-test.
    mutateResultRef: { current: Promise.resolve() as Promise<unknown> },
  }
})

vi.mock('../../../api/vault', () => ({
  useCreateVaultEntryMutation: () => ({
    mutateAsync: mutateSpy,
    isPending: false,
  }),
}))

vi.mock('@tamagui/lucide-icons', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Text } = require('react-native')
  return {
    Check: (props: Record<string, unknown>) => <Text testID="icon-check" {...props} />,
    X: (props: Record<string, unknown>) => <Text testID="icon-x" {...props} />,
    Brain: (props: Record<string, unknown>) => <Text testID="icon-brain" {...props} />,
  }
})

import { ProposalStrip } from '../ProposalStrip'

const PROPOSAL: MemoryProposal = {
  topic: 'food_and_restaurants',
  label: 'loves_ramen',
  value: 'Tonkotsu above all',
}

beforeEach(() => {
  mutateSpy.mockReset()
  mutateSpy.mockResolvedValue(undefined)
})

describe('ProposalStrip — rendering', () => {
  it('renders the proposal value text', () => {
    const { getByText } = render(<ProposalStrip proposal={PROPOSAL} onDismiss={vi.fn()} />)
    expect(getByText('Tonkotsu above all')).toBeTruthy()
  })

  it('renders a Save button', () => {
    const { getByLabelText } = render(<ProposalStrip proposal={PROPOSAL} onDismiss={vi.fn()} />)
    expect(getByLabelText('Save memory')).toBeTruthy()
  })

  it('renders a Reject button', () => {
    const { getByLabelText } = render(<ProposalStrip proposal={PROPOSAL} onDismiss={vi.fn()} />)
    expect(getByLabelText('Reject memory')).toBeTruthy()
  })
})

describe('ProposalStrip — Save', () => {
  it('calls useCreateVaultEntryMutation with the correct vault entry shape', async () => {
    const onDismiss = vi.fn()
    const { getByLabelText } = render(<ProposalStrip proposal={PROPOSAL} onDismiss={onDismiss} />)

    await act(async () => {
      fireEvent.press(getByLabelText('Save memory'))
    })

    expect(mutateSpy).toHaveBeenCalledWith({
      type: 'preference',
      topic: 'food_and_restaurants',
      content: expect.objectContaining({
        subject: 'loves_ramen',
        notes: 'Tonkotsu above all',
        sentiment: 'likes',
      }),
    })
  })

  it('calls onDismiss after a successful save', async () => {
    const onDismiss = vi.fn()
    const { getByLabelText } = render(<ProposalStrip proposal={PROPOSAL} onDismiss={onDismiss} />)

    await act(async () => {
      fireEvent.press(getByLabelText('Save memory'))
    })

    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('calls onDismiss even when the mutation rejects (save silently fails)', async () => {
    mutateSpy.mockRejectedValueOnce(new Error('network'))
    const onDismiss = vi.fn()
    const { getByLabelText } = render(<ProposalStrip proposal={PROPOSAL} onDismiss={onDismiss} />)

    await act(async () => {
      fireEvent.press(getByLabelText('Save memory'))
    })

    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})

describe('ProposalStrip — Reject', () => {
  it('calls onDismiss without calling the mutation', async () => {
    const onDismiss = vi.fn()
    const { getByLabelText } = render(<ProposalStrip proposal={PROPOSAL} onDismiss={onDismiss} />)

    await act(async () => {
      fireEvent.press(getByLabelText('Reject memory'))
    })

    expect(mutateSpy).not.toHaveBeenCalled()
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})

describe('ProposalStrip — fashion topic', () => {
  it('maps fashion topic correctly', async () => {
    const fashionProposal: MemoryProposal = {
      topic: 'fashion',
      label: 'prefers_slim_fit',
      value: 'Slim fit jeans, never baggy',
    }
    const onDismiss = vi.fn()
    const { getByLabelText } = render(
      <ProposalStrip proposal={fashionProposal} onDismiss={onDismiss} />,
    )

    await act(async () => {
      fireEvent.press(getByLabelText('Save memory'))
    })

    expect(mutateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ topic: 'fashion', type: 'preference' }),
    )
  })
})
