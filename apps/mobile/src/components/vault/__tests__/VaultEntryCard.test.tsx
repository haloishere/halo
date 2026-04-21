import { describe, it, expect, vi } from 'vitest'

vi.mock('@tamagui/lucide-icons', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- vi.mock factory must use require
  const { Text } = require('react-native')
  return {
    Trash2: (props: Record<string, unknown>) => <Text testID="icon-trash" {...props} />,
  }
})

import { render, fireEvent, act } from '../../../test/render'
import { VaultEntryCard } from '../VaultEntryCard'

const baseRecord = {
  id: '11111111-1111-1111-1111-111111111111',
  userId: '22222222-2222-2222-2222-222222222222',
  type: 'preference' as const,
  topic: 'fashion' as const,
  content: {
    category: 'lifestyle' as const,
    subject: 'loves minimalist',
    sentiment: 'likes' as const,
    confidence: 0.9,
    notes: 'Clean lines, neutral palette',
  },
  createdAt: '2026-04-21T10:00:00.000Z',
  updatedAt: '2026-04-21T10:00:00.000Z',
  deletedAt: null,
}

describe('VaultEntryCard — record variant', () => {
  it('renders subject, notes, and a human-label topic badge (not the raw enum key)', () => {
    const { getByText, queryByText } = render(
      <VaultEntryCard entry={baseRecord} onDelete={vi.fn()} />,
    )
    expect(getByText('loves minimalist')).toBeTruthy()
    expect(getByText('Clean lines, neutral palette')).toBeTruthy()
    // Human label from `TOPIC_LABELS`, NOT the underscored enum key.
    expect(getByText('Fashion')).toBeTruthy()
    expect(queryByText('fashion')).toBeNull()
    expect(queryByText('food_and_restaurants')).toBeNull()
  })

  it('falls back to subject alone when notes are absent', () => {
    const noNotes = {
      ...baseRecord,
      content: { ...baseRecord.content, notes: undefined },
    }
    const { getByText, queryAllByText } = render(
      <VaultEntryCard entry={noNotes} onDelete={vi.fn()} />,
    )
    expect(getByText('loves minimalist')).toBeTruthy()
    // Subject renders exactly once — no value-slot echo when notes are absent.
    expect(queryAllByText('loves minimalist')).toHaveLength(1)
  })

  it('delete button opens a confirm dialog and fires onDelete when confirmed', () => {
    const onDelete = vi.fn()
    const { getByLabelText, getByText } = render(
      <VaultEntryCard entry={baseRecord} onDelete={onDelete} />,
    )

    act(() => {
      fireEvent.press(getByLabelText('Delete memory'))
    })
    // ConfirmDialog uses its `confirmLabel` as the accessibility label.
    act(() => {
      fireEvent.press(getByText('Delete'))
    })

    expect(onDelete).toHaveBeenCalledWith({ id: baseRecord.id, topic: 'fashion' })
  })

  it('cancel on the confirm dialog does NOT fire onDelete', () => {
    const onDelete = vi.fn()
    const { getByLabelText, getByText } = render(
      <VaultEntryCard entry={baseRecord} onDelete={onDelete} />,
    )
    act(() => {
      fireEvent.press(getByLabelText('Delete memory'))
    })
    act(() => {
      fireEvent.press(getByText('Cancel'))
    })
    expect(onDelete).not.toHaveBeenCalled()
  })
})

describe('VaultEntryCard — failed-decrypt sentinel variant', () => {
  const failed = {
    id: 'fff11111-1111-1111-1111-111111111111',
    userId: '22222222-2222-2222-2222-222222222222',
    rawType: 'preference',
    rawTopic: 'fashion',
    content: null,
    decryptionFailed: true as const,
    createdAt: '2026-04-21T10:00:00.000Z',
    updatedAt: '2026-04-21T10:00:00.000Z',
    deletedAt: null,
  }

  it('renders a "decryption failed" placeholder row without crashing', () => {
    const { getByText } = render(<VaultEntryCard entry={failed} onDelete={vi.fn()} />)
    expect(getByText(/decryption failed/i)).toBeTruthy()
  })

  it('still offers a delete affordance (user can clear corrupted rows from their view)', () => {
    const onDelete = vi.fn()
    const { getByLabelText, getByText } = render(
      <VaultEntryCard entry={failed} onDelete={onDelete} />,
    )
    act(() => {
      fireEvent.press(getByLabelText('Delete memory'))
    })
    act(() => {
      fireEvent.press(getByText('Delete'))
    })
    expect(onDelete).toHaveBeenCalledWith({ id: failed.id, topic: 'fashion' })
  })
})
