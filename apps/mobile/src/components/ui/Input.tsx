import { forwardRef, useState } from 'react'
import { type TextInput, type TextInputProps as RNTextInputProps } from 'react-native'
import { Input as TamaguiInput, Label, YStack, SizableText } from 'tamagui'

export interface InputProps extends RNTextInputProps {
  label?: string
  error?: string
  /** Forward to the outer YStack container so <Input flex={1}> works inside XStack */
  flex?: number
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, onFocus, onBlur, flex, ...inputProps },
  ref,
) {
  const [focused, setFocused] = useState(false)

  return (
    <YStack gap="$1.5" flex={flex}>
      {label && (
        <Label size="$3" fontWeight="500" color="$color">
          {label}
        </Label>
      )}
      <TamaguiInput
        // Tamagui v2 RC types TamaguiInput's ref as `View | HTMLElement`
        // rather than TextInput, so no narrower cast compiles. The runtime
        // ref is a TextInput — our public InputProps exposes it correctly.
        // Remove this cast the day Tamagui's types resolve to TextInput.
        ref={ref as never}
        height={56}
        borderWidth={1.5}
        borderColor={(error ? '$red9' : focused ? '$accent7' : '$color6') as '$color4'}
        borderRadius="$6"
        paddingHorizontal="$5"
        backgroundColor="$color1"
        size="$5"
        color="$color"
        // @ts-expect-error — Tamagui v2 RC doesn't resolve '$color6' as ColorTokens
        placeholderTextColor="$color6"
        onFocus={(e) => {
          setFocused(true)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onFocus?.(e as any)
        }}
        onBlur={(e) => {
          setFocused(false)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onBlur?.(e as any)
        }}
        {...inputProps}
      />
      {error && (
        <SizableText size="$3" color="$red11">
          {error}
        </SizableText>
      )}
    </YStack>
  )
})
