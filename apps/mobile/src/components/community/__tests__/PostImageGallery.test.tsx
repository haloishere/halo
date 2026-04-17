import React from 'react'
import { Text } from 'react-native'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, fireEvent } from '@testing-library/react-native'
import { render } from '../../../test/render'

// Lucide icons reach for Tamagui theme context via a code path that does not
// resolve through the native.cjs alias used by our Vitest setup, so render
// them as plain text stubs (same pattern as app/(tabs)/__tests__/community.test.tsx:11-19).
vi.mock('@tamagui/lucide-icons', () => ({
  ArrowLeft: (props: Record<string, unknown>) => <Text {...props}>ArrowLeftIcon</Text>,
}))

// Capture the latest onRequestClose and render a queryable stub for ImageView.
const { viewerRef } = vi.hoisted(() => ({
  viewerRef: { current: { onRequestClose: null as null | (() => void) } },
}))

vi.mock('react-native-image-viewing', () => ({
  __esModule: true,
  default: ({
    visible,
    imageIndex,
    images,
    onRequestClose,
    HeaderComponent,
  }: {
    visible: boolean
    imageIndex: number
    images: { uri: string }[]
    onRequestClose: () => void
    HeaderComponent?: React.ComponentType<{ imageIndex: number }>
  }) => {
    viewerRef.current.onRequestClose = onRequestClose
    if (!visible) return null
    return (
      <>
        {HeaderComponent ? <HeaderComponent imageIndex={imageIndex} /> : null}
        <Text testID="image-viewer">{`viewer:${imageIndex}:${images.length}`}</Text>
      </>
    )
  },
}))

import { PostImageGallery, type GalleryImage } from '../PostImageGallery'

const URLS = [
  'https://cdn.example.com/a.jpg',
  'https://cdn.example.com/b.jpg',
  'https://cdn.example.com/c.jpg',
]

const toImages = (urls: string[]): GalleryImage[] => urls.map((url) => ({ url }))

// Card-variant props (matches PostCard.tsx call site)
const CARD = {
  thumbnailHeight: 150,
  thumbnailRadius: '$3' as const,
  containerPaddingX: '$4' as const,
}

// Detail-variant props (matches app/community/[id].tsx call site)
const DETAIL = {
  thumbnailHeight: 200,
  thumbnailRadius: '$4' as const,
  multiImageLayout: 'stack' as const,
}

describe('PostImageGallery', () => {
  beforeEach(() => {
    viewerRef.current.onRequestClose = null
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when images is empty', () => {
    const { queryByLabelText, queryByTestId } = render(<PostImageGallery images={[]} {...CARD} />)
    expect(queryByLabelText(/Post image/)).toBeNull()
    expect(queryByTestId('image-viewer')).toBeNull()
  })

  it('renders one accessible thumbnail per image', () => {
    const { getByLabelText } = render(<PostImageGallery images={toImages(URLS)} {...CARD} />)
    expect(getByLabelText('Post image 1 of 3')).toBeTruthy()
    expect(getByLabelText('Post image 2 of 3')).toBeTruthy()
    expect(getByLabelText('Post image 3 of 3')).toBeTruthy()
  })

  it('keeps the viewer hidden by default', () => {
    const { queryByTestId } = render(<PostImageGallery images={toImages(URLS)} {...CARD} />)
    expect(queryByTestId('image-viewer')).toBeNull()
  })

  it('opens the viewer at the tapped index', () => {
    const { getByLabelText, getByTestId } = render(
      <PostImageGallery images={toImages(URLS)} {...CARD} />,
    )
    fireEvent.press(getByLabelText('Post image 2 of 3'))
    // index is 0-based → tapping thumbnail "2 of 3" opens at index 1
    expect(getByTestId('image-viewer').props.children).toBe('viewer:1:3')
  })

  it('dismisses the viewer when onRequestClose fires', () => {
    const { getByLabelText, queryByTestId, getByTestId } = render(
      <PostImageGallery images={toImages(URLS)} {...CARD} />,
    )
    fireEvent.press(getByLabelText('Post image 1 of 3'))
    expect(getByTestId('image-viewer')).toBeTruthy()

    expect(viewerRef.current.onRequestClose).toBeTypeOf('function')
    act(() => {
      viewerRef.current.onRequestClose?.()
    })
    expect(queryByTestId('image-viewer')).toBeNull()
  })

  it('stops event propagation so the card press handler does not fire', () => {
    const stopPropagation = vi.fn()
    const { getByLabelText } = render(<PostImageGallery images={toImages(URLS)} {...CARD} />)

    fireEvent.press(getByLabelText('Post image 1 of 3'), {
      stopPropagation,
      nativeEvent: {},
    })
    expect(stopPropagation).toHaveBeenCalledTimes(1)
  })

  it('applies card thumbnail sizing for multi-image posts', () => {
    const { getByLabelText } = render(<PostImageGallery images={toImages(URLS)} {...CARD} />)
    const thumb = getByLabelText('Post image 1 of 3')
    const style = Array.isArray(thumb.props.style)
      ? Object.assign({}, ...thumb.props.style.filter(Boolean))
      : (thumb.props.style ?? {})
    expect(style.width).toBe(150)
    expect(style.height).toBe(150)
  })

  it('applies full-width sizing when there is exactly one image', () => {
    const { getByLabelText } = render(
      <PostImageGallery images={toImages(URLS.slice(0, 1))} {...CARD} />,
    )
    const thumb = getByLabelText('Post image 1 of 1')
    const style = Array.isArray(thumb.props.style)
      ? Object.assign({}, ...thumb.props.style.filter(Boolean))
      : (thumb.props.style ?? {})
    expect(style.width).toBe('100%')
    expect(style.height).toBe(150)
  })

  it('applies detail thumbnail height (200) when configured', () => {
    const { getByLabelText } = render(<PostImageGallery images={toImages(URLS)} {...DETAIL} />)
    const thumb = getByLabelText('Post image 1 of 3')
    const style = Array.isArray(thumb.props.style)
      ? Object.assign({}, ...thumb.props.style.filter(Boolean))
      : (thumb.props.style ?? {})
    expect(style.width).toBe('100%')
    expect(style.height).toBe(200)
  })

  it('shows a "N of M" counter in the viewer when open', () => {
    const { getByLabelText, getByText } = render(
      <PostImageGallery images={toImages(URLS)} {...CARD} />,
    )
    fireEvent.press(getByLabelText('Post image 2 of 3'))
    // Index is 0-based so tapping thumbnail "2 of 3" shows counter "2 of 3"
    expect(getByText('2 of 3')).toBeTruthy()
  })

  it('renders a "Go back" button in the viewer header when open', () => {
    const { getByLabelText, queryByLabelText } = render(
      <PostImageGallery images={toImages(URLS)} {...CARD} />,
    )
    expect(queryByLabelText('Go back')).toBeNull()
    fireEvent.press(getByLabelText('Post image 1 of 3'))
    expect(getByLabelText('Go back')).toBeTruthy()
  })

  it('dismisses the viewer when the back button is pressed', () => {
    const { getByLabelText, queryByTestId, getByTestId } = render(
      <PostImageGallery images={toImages(URLS)} {...CARD} />,
    )
    fireEvent.press(getByLabelText('Post image 1 of 3'))
    expect(getByTestId('image-viewer')).toBeTruthy()

    fireEvent.press(getByLabelText('Go back'))
    expect(queryByTestId('image-viewer')).toBeNull()
  })
})
