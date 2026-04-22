import { describe, it, expect, vi } from 'vitest'

vi.mock('@tamagui/lucide-icons', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- vi.mock factory must use require
  const { Text } = require('react-native')
  return {
    Trash2: (props: Record<string, unknown>) => <Text testID="icon-trash" {...props} />,
  }
})

import { render } from '../../../test/render'
import { VaultTopicSection } from '../VaultTopicSection'

const fashionRecord = {
  id: '11111111-1111-1111-1111-111111111111',
  userId: '22222222-2222-2222-2222-222222222222',
  type: 'preference' as const,
  topic: 'fashion' as const,
  content: {
    category: 'lifestyle' as const,
    subject: 'loves minimalist',
    sentiment: 'likes' as const,
    confidence: 0.9,
  },
  createdAt: '2026-04-21T10:00:00.000Z',
  updatedAt: '2026-04-21T10:00:00.000Z',
  deletedAt: null,
}

describe('VaultTopicSection', () => {
  it('renders the topic title and each child entry', () => {
    const { getAllByText, getByText } = render(
      <VaultTopicSection title="Fashion" entries={[fashionRecord]} onDelete={vi.fn()} />,
    )
    // "Fashion" now appears BOTH as the section title AND as the topic-badge
    // label on the entry card (via TOPIC_LABELS). At least one must be there.
    expect(getAllByText('Fashion').length).toBeGreaterThanOrEqual(1)
    expect(getByText('loves minimalist')).toBeTruthy()
  })

  it('renders an empty-state hint when the list is empty', () => {
    const { getByText } = render(
      <VaultTopicSection
        title="Fashion"
        entries={[]}
        onDelete={vi.fn()}
        emptyHint="Halo hasn't learned about your fashion yet."
      />,
    )
    expect(getByText("Halo hasn't learned about your fashion yet.")).toBeTruthy()
  })

  it('shows the entry count next to the title when non-empty', () => {
    const two = [fashionRecord, { ...fashionRecord, id: 'other' }]
    const { getByText } = render(
      <VaultTopicSection title="Fashion" entries={two} onDelete={vi.fn()} />,
    )
    // Count appears as a plain number next to the title — keep the assertion
    // lenient so we can tweak the glyph (dot, parens, badge) without churn.
    expect(getByText(/2/)).toBeTruthy()
  })
})
