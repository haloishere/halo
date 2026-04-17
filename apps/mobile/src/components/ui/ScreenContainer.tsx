import type { ReactNode } from 'react'
import { useWindowDimensions } from 'react-native'
import { KeyboardAvoidingView } from 'react-native-keyboard-controller'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { YStack, ScrollView } from 'tamagui'

export interface ScreenContainerProps {
  children: ReactNode
  scrollable?: boolean
  centered?: boolean
  footer?: ReactNode
}

export function ScreenContainer({
  children,
  scrollable = true,
  centered = false,
  footer,
}: ScreenContainerProps) {
  const { height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const centeredPadding = centered ? { paddingTop: height * 0.15 } : {}

  const content = (
    <YStack flex={1} backgroundColor="$background">
      {scrollable ? (
        <ScrollView
          flex={1}
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <YStack padding="$6" style={centeredPadding}>
            {children}
          </YStack>
        </ScrollView>
      ) : (
        <YStack flex={1} padding="$6" style={centeredPadding}>
          {children}
        </YStack>
      )}
      {footer && (
        <YStack padding="$6" paddingBottom={Math.max(insets.bottom, 24)}>
          {footer}
        </YStack>
      )}
    </YStack>
  )

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior="padding"
    >
      {content}
    </KeyboardAvoidingView>
  )
}
