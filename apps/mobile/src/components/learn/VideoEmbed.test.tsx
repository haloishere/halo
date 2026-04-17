import { describe, it, expect, vi } from 'vitest'
import { render } from '../../test/render'
import { VideoEmbed } from './VideoEmbed'

vi.mock('react-native-webview', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react')
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) =>
      React.createElement('View', { ...props, testID: 'webview' }),
  }
})

describe('VideoEmbed', () => {
  it('renders webview for YouTube URL', () => {
    const { getByTestId } = render(
      <VideoEmbed url="https://www.youtube.com/watch?v=abc123" />,
    )
    expect(getByTestId('webview')).toBeTruthy()
  })

  it('renders webview for Vimeo URL', () => {
    const { getByTestId } = render(
      <VideoEmbed url="https://vimeo.com/123456789" />,
    )
    expect(getByTestId('webview')).toBeTruthy()
  })

  it('renders nothing for invalid URL', () => {
    const { queryByTestId } = render(<VideoEmbed url="not-a-url" />)
    expect(queryByTestId('webview')).toBeNull()
  })

  it('renders nothing for empty URL', () => {
    const { queryByTestId } = render(<VideoEmbed url="" />)
    expect(queryByTestId('webview')).toBeNull()
  })
})
