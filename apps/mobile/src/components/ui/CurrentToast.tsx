import { useEffect, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import { useToastController, useToastState } from '@tamagui/toast'
import { SizableText, YStack } from 'tamagui'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'

const TAB_BAR_HEIGHT = 60
const TOAST_SPACING = 16

export function CurrentToast() {
  const currentToast = useToastState()
  const toastCtrl = useToastController()
  const hideRef = useRef(toastCtrl.hide)
  hideRef.current = toastCtrl.hide
  const insets = useSafeAreaInsets()

  useEffect(() => {
    if (!currentToast) return
    const timer = setTimeout(() => hideRef.current(), currentToast.duration ?? 4000)
    return () => clearTimeout(timer)
  }, [currentToast?.id, currentToast?.duration])

  return (
    <View
      style={[
        StyleSheet.absoluteFillObject,
        {
          zIndex: 100_000,
          justifyContent: 'flex-end',
          alignItems: 'center',
          paddingBottom: insets.bottom + TAB_BAR_HEIGHT + TOAST_SPACING,
        },
      ]}
      pointerEvents="box-none"
    >
      {currentToast && !currentToast.isHandledNatively && (
        <Animated.View
          key={currentToast.id}
          entering={FadeIn.duration(300)}
          exiting={FadeOut.duration(200)}
        >
          <YStack
            accessible
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            backgroundColor="$color2"
            borderWidth={1}
            borderColor="$color6"
            borderRadius={999}
            paddingHorizontal="$6"
            paddingVertical="$3"
            marginHorizontal="$5"
            elevation="$2"
            gap="$1"
          >
            <SizableText fontWeight="600" color="$color">
              {currentToast.title}
            </SizableText>
            {currentToast.message && (
              <SizableText color="$color11" size="$3">
                {currentToast.message}
              </SizableText>
            )}
          </YStack>
        </Animated.View>
      )}
    </View>
  )
}
