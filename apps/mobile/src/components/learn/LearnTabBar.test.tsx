import { describe, it, expect, vi } from 'vitest'
import { fireEvent } from '@testing-library/react-native'
import { Tabs } from 'tamagui'
import { render } from '../../test/render'
import { UnderlineTabBar } from '../ui'
import { LEARN_TABS, LEARN_TAB_LABELS } from './constants'

function renderTabBar(activeTab = 'for-you', onValueChange = vi.fn()) {
  return render(
    <Tabs value={activeTab} onValueChange={onValueChange}>
      <UnderlineTabBar tabs={LEARN_TABS} labels={LEARN_TAB_LABELS} activeTab={activeTab as 'for-you'} />
    </Tabs>,
  )
}

describe('UnderlineTabBar (Learn)', () => {
  it('renders all 4 tab labels', () => {
    const { getByText } = renderTabBar()
    expect(getByText('For You')).toBeTruthy()
    expect(getByText('Topics')).toBeTruthy()
    expect(getByText('Bookmarks')).toBeTruthy()
    expect(getByText('Learning Path')).toBeTruthy()
  })

  it('calls onValueChange when a tab is pressed', () => {
    const onValueChange = vi.fn()
    const { getByText } = renderTabBar('for-you', onValueChange)
    fireEvent.press(getByText('Topics'))
    expect(onValueChange).toHaveBeenCalledWith('topics')
  })

  it('marks active tab for accessibility', () => {
    const { getByLabelText } = renderTabBar()
    const forYouTab = getByLabelText('For You')
    expect(forYouTab).toBeTruthy()
  })

  it('renders different active tab', () => {
    const { getByLabelText } = renderTabBar('bookmarks')
    expect(getByLabelText('Bookmarks')).toBeTruthy()
  })
})
