import { describe, it, expect } from 'vitest'
import { render } from '../../test/render'
import { CategoryBadge } from './CategoryBadge'

describe('CategoryBadge', () => {
  it('renders the category label', () => {
    const { getByText } = render(<CategoryBadge category="daily_care" />)
    expect(getByText('Daily Care')).toBeTruthy()
  })

  it('renders all category labels correctly', () => {
    const categories = [
      { value: 'understanding_disease', label: 'Understanding the Disease' },
      { value: 'safety', label: 'Safety' },
      { value: 'self_care', label: 'Self Care' },
      { value: 'communication', label: 'Communication' },
      { value: 'legal_financial', label: 'Legal & Financial' },
      { value: 'behavioral_management', label: 'Behavioral Management' },
    ] as const

    for (const { value, label } of categories) {
      const { getByText } = render(<CategoryBadge category={value} />)
      expect(getByText(label)).toBeTruthy()
    }
  })

  it('renders with testID', () => {
    const { getByTestId } = render(<CategoryBadge category="safety" />)
    expect(getByTestId('category-badge')).toBeTruthy()
  })
})
