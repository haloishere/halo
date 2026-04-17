import type { ComponentProps, ComponentType } from 'react'
import { memo, useCallback, useMemo, useState } from 'react'
import { Image, type GestureResponderEvent, type ImageStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { XStack, SizableText } from 'tamagui'
import { ArrowLeft } from '@tamagui/lucide-icons'
import ImageView from 'react-native-image-viewing'

/**
 * Normalized image shape consumed by the gallery. Keeping it local (rather than
 * taking the shared schema type directly) means the caller can map from the
 * current `imageUrls: string[]` representation today, and from the richer
 * `PostImage[]` shape issue #115 will introduce tomorrow, without the component
 * caring which it receives.
 */
export type GalleryImage = {
  url: string
  width?: number
  height?: number
}

type RadiusProp = ComponentProps<typeof XStack>['borderRadius']
type PaddingProp = ComponentProps<typeof XStack>['paddingHorizontal']

interface PostImageGalleryProps {
  images: GalleryImage[]
  /** Pixel height of each thumbnail (150 on the feed card, 200 on detail). */
  thumbnailHeight: number
  /** Tamagui radius token applied to every thumbnail (and mirrored on the Image). */
  thumbnailRadius: RadiusProp
  /** Optional horizontal padding on the outer row. Feed cards pad to `$4`; detail has none. */
  containerPaddingX?: PaddingProp
  /**
   * Layout for posts with more than one image.
   *   - `'grid'` (default) → 150-px square tiles in a flex-wrap row (feed card)
   *   - `'stack'` → each image takes the full row width and they stack vertically (post detail)
   * Single-image posts always render full-width regardless of this value.
   */
  multiImageLayout?: 'grid' | 'stack'
}

type ViewerState = { open: boolean; index: number }
const CLOSED: ViewerState = { open: false, index: 0 }

// Matches HeaderBar.tsx — keeps the viewer's back button visually consistent
// with the rest of the app's screens.
const BACK_BUTTON_WIDTH = 32

/**
 * Thumbnail grid + fullscreen viewer for community post images.
 *
 * Tapping a thumbnail opens a pinch-to-zoom, swipe-to-dismiss viewer backed by
 * react-native-image-viewing. Each thumbnail stops press propagation so the
 * parent PostCard's navigation handler does not fire on an image tap.
 *
 * The fullscreen viewer shows a minimal "N of M" counter at the top; users
 * dismiss via swipe-down (enabled via `swipeToCloseEnabled`) or the system
 * back button on Android.
 */
function PostImageGalleryComponent({
  images,
  thumbnailHeight,
  thumbnailRadius,
  containerPaddingX,
  multiImageLayout = 'grid',
}: PostImageGalleryProps) {
  const [viewer, setViewer] = useState<ViewerState>(CLOSED)

  const handlePress = useCallback((index: number, e?: GestureResponderEvent) => {
    // Guard both the event and the method: React Native always passes a real
    // GestureResponderEvent, but RNTL's fireEvent.press may omit it entirely.
    e?.stopPropagation?.()
    setViewer({ open: true, index })
  }, [])

  const close = useCallback(() => {
    setViewer((prev) => ({ ...prev, open: false }))
  }, [])

  // The viewer keys off array identity — recreating it on every render would
  // reset scroll position and pinch-zoom state inside the modal.
  const sources = useMemo(() => images.map(({ url }) => ({ uri: url })), [images])

  const count = images.length

  // Top header for the fullscreen viewer: a back arrow on the left (matching
  // HeaderBar's pattern at src/components/ui/HeaderBar.tsx) plus a centered
  // "N of M" counter. Defined inline so `close` and `count` are captured via
  // closure (react-native-image-viewing only passes `imageIndex` to
  // HeaderComponent), and memoized so the library sees a stable component
  // identity across renders.
  const ViewerHeader = useMemo<ComponentType<{ imageIndex: number }>>(() => {
    return function ViewerHeaderInner({ imageIndex }: { imageIndex: number }) {
      const insets = useSafeAreaInsets()
      return (
        <XStack
          position="absolute"
          top={insets.top + 8}
          left={0}
          right={0}
          paddingHorizontal="$4"
          alignItems="center"
          pointerEvents="box-none"
        >
          <XStack
            width={BACK_BUTTON_WIDTH}
            alignItems="center"
            onPress={close}
            pressStyle={{ opacity: 0.7 }}
            padding="$1"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ArrowLeft size={24} color="white" />
          </XStack>

          <SizableText
            flex={1}
            textAlign="center"
            size="$3"
            color="white"
            fontWeight="600"
            style={{
              textShadowColor: 'rgba(0, 0, 0, 0.75)',
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 3,
            }}
          >
            {imageIndex + 1} of {count}
          </SizableText>

          {/* Spacer matches the back-button width so the counter stays visually centered */}
          <XStack width={BACK_BUTTON_WIDTH} />
        </XStack>
      )
    }
  }, [count, close])

  if (count === 0) return null

  const isSingle = count === 1

  return (
    <XStack gap="$2" flexWrap="wrap" paddingHorizontal={containerPaddingX}>
      {images.map(({ url }, i) => {
        const style: ImageStyle = {
          width: isSingle || multiImageLayout === 'stack' ? '100%' : 150,
          height: thumbnailHeight,
        }

        return (
          <XStack
            key={`${i}:${url}`}
            onPress={(e: GestureResponderEvent) => handlePress(i, e)}
            pressStyle={{ opacity: 0.85, scale: 0.99 }}
            accessible
            accessibilityRole="button"
            accessibilityLabel={`Post image ${i + 1} of ${count}`}
            accessibilityHint="Opens fullscreen image viewer"
            borderRadius={thumbnailRadius}
            overflow="hidden"
            // Forward the thumbnail sizing onto the same node that owns the
            // accessibility label so tests can assert width/height consistently.
            style={style}
          >
            <Image source={{ uri: url }} style={style} resizeMode="cover" />
          </XStack>
        )
      })}

      <ImageView
        images={sources}
        imageIndex={viewer.index}
        visible={viewer.open}
        onRequestClose={close}
        swipeToCloseEnabled
        doubleTapToZoomEnabled
        presentationStyle="overFullScreen"
        HeaderComponent={ViewerHeader}
      />
    </XStack>
  )
}

export const PostImageGallery = memo(PostImageGalleryComponent)
