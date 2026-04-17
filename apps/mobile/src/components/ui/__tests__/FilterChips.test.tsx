import { describe, it, expect, vi } from 'vitest'
import { fireEvent } from '@testing-library/react-native'
import { CONTENT_CATEGORIES } from '@halo/shared'
import { render } from '../../../test/render'
import { FilterChips } from '../FilterChips'
import { getCategoryLabel } from '../../../lib/content-utils'

function renderChips(selected: string | undefined = undefined, onSelect = vi.fn()) {
  return render(
    <FilterChips
      items={CONTENT_CATEGORIES}
      selected={selected as (typeof CONTENT_CATEGORIES)[number] | undefined}
      onSelect={onSelect}
      getLabel={getCategoryLabel}
    />,
  )
}

describe('FilterChips (Content Categories)', () => {
  it('renders All chip plus 7 category chips', () => {
    const { getAllByRole } = renderChips()
    // All + 7 categories = 8 chips
    const chips = getAllByRole('checkbox')
    expect(chips).toHaveLength(8)
  })

  it('highlights All chip when no category selected', () => {
    const { getByText } = renderChips()
    expect(getByText('All')).toBeTruthy()
  })

  it('calls onSelect with category when chip pressed', () => {
    const onSelect = vi.fn()
    renderChips(undefined, onSelect)

    fireEvent.press(renderChips(undefined, onSelect).getByText('Safety'))
    expect(onSelect).toHaveBeenCalledWith('safety')
  })

  it('calls onSelect with undefined when All pressed', () => {
    const onSelect = vi.fn()
    const { getByText } = renderChips('safety', onSelect)

    fireEvent.press(getByText('All'))
    expect(onSelect).toHaveBeenCalledWith(undefined)
  })
})
