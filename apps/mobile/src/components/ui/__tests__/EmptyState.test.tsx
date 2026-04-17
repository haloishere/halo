import { describe, it, expect } from 'vitest'
import { Text } from 'react-native'
import { render } from '../../../test/render'
import { EmptyState } from '../EmptyState'

function MockIcon(_props: Record<string, unknown>) {
  return <Text testID="mock-icon">MockIcon</Text>
}

describe('EmptyState', () => {
  it('renders icon and title', () => {
    const { getByText, getByTestId } = render(
      <EmptyState icon={MockIcon} title="No articles found" />,
    )
    expect(getByTestId('mock-icon')).toBeTruthy()
    expect(getByText('No articles found')).toBeTruthy()
  })

  it('renders subtitle when provided', () => {
    const { getByText } = render(
      <EmptyState icon={MockIcon} title="No bookmarks" subtitle="Save articles to find them here" />,
    )
    expect(getByText('No bookmarks')).toBeTruthy()
    expect(getByText('Save articles to find them here')).toBeTruthy()
  })

  it('does not render subtitle when not provided', () => {
    const { queryByText } = render(
      <EmptyState icon={MockIcon} title="No articles" />,
    )
    expect(queryByText('Save articles to find them here')).toBeNull()
  })

  it('renders loading spinner when isLoading is true', () => {
    const { getByTestId, queryByText } = render(
      <EmptyState icon={MockIcon} title="No articles" isLoading />,
    )
    expect(getByTestId('empty-state-loading')).toBeTruthy()
    expect(queryByText('No articles')).toBeNull()
  })

  it('renders empty state content when not loading', () => {
    const { getByTestId } = render(
      <EmptyState icon={MockIcon} title="No articles" />,
    )
    expect(getByTestId('empty-state')).toBeTruthy()
  })
})
