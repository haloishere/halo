import type { ReactNode, JSX } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { XStack, SizableText, YStack } from 'tamagui'
import { ArrowLeft } from '@tamagui/lucide-icons'
import { useRouter } from 'expo-router'
import { HEADER_BAR_HEIGHT } from './constants'

// Width budgeted for each side slot (back button OR right action). Kept
// identical for both sides so that the symmetric-spacer logic below can
// use a single constant for spacer width, guaranteeing the title stays
// horizontally centered regardless of which slot is populated.
const SIDE_SLOT_WIDTH = 32

export interface HeaderBarProps {
  title?: string | JSX.Element
  /**
   * Override the default title slot entirely with a custom node. Takes
   * precedence over `title`. When `left` is set, the symmetric-spacer
   * logic is disabled — caller owns the layout.
   */
  left?: ReactNode
  /** Show a back arrow in the left slot that calls router.back() */
  showBack?: boolean
  /**
   * Optional right-slot node (typically an icon button). The caller owns
   * the press handler. When present, a left-side spacer is rendered if
   * and only if `showBack` is false, so the title stays centered in the
   * four slot combinations (neither / back only / rightAction only / both).
   */
  rightAction?: ReactNode
}

export function HeaderBar({ title, left, showBack, rightAction }: HeaderBarProps) {
  const insets = useSafeAreaInsets()
  const router = useRouter()

  // Symmetric spacer rules — only applicable when the default title slot
  // is used (`!left`) AND a title is rendered. When `left` is set the
  // caller controls layout and spacers would fight their intent.
  const showLeftSpacer = !showBack && rightAction != null && title != null && !left
  const showRightSpacer = showBack && rightAction == null && title != null && !left

  return (
    <YStack
      backgroundColor="$background"
      paddingTop={insets.top}
      borderBottomWidth={1}
      borderBottomColor="$color4"
    >
      <XStack height={HEADER_BAR_HEIGHT} alignItems="center" paddingHorizontal="$4" gap="$3">
        {/* LEFT slot: back button OR symmetric spacer OR nothing */}
        {showBack && (
          <XStack
            width={SIDE_SLOT_WIDTH}
            alignItems="center"
            onPress={() => router.back()}
            pressStyle={{ opacity: 0.7 }}
            padding="$1"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ArrowLeft size={24} color="$color" />
          </XStack>
        )}
        {showLeftSpacer && <XStack width={SIDE_SLOT_WIDTH} />}

        {/* TITLE slot */}
        {left ??
          (title != null ? (
            typeof title === 'string' ? (
              <SizableText
                size={showBack || rightAction ? '$6' : '$8'}
                color="$color"
                fontWeight={showBack || rightAction ? '600' : '700'}
                fontFamily="$brand"
                numberOfLines={1}
                flex={1}
                textAlign="center"
              >
                {title}
              </SizableText>
            ) : (
              <XStack flex={1} alignItems="center" justifyContent="center">
                {title}
              </XStack>
            )
          ) : null)}

        {/* RIGHT slot: rightAction OR symmetric spacer OR nothing */}
        {rightAction != null && (
          <XStack width={SIDE_SLOT_WIDTH} alignItems="center" justifyContent="center">
            {rightAction}
          </XStack>
        )}
        {showRightSpacer && <XStack width={SIDE_SLOT_WIDTH} />}
      </XStack>
    </YStack>
  )
}
