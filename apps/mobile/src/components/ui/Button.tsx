import type { JSX } from 'react'
import type { ViewStyle } from 'react-native'
import { Button as TamaguiButton, Spinner, Theme } from 'tamagui'

export interface ButtonProps {
  label: string
  onPress?: () => void
  variant?: 'primary' | 'secondary' | 'outline'
  loading?: boolean
  disabled?: boolean
  marginTop?: ViewStyle['marginTop'] | string
  icon?: JSX.Element
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  marginTop,
  icon,
}: ButtonProps) {
  const isDisabled = disabled || loading

  // Tamagui v2 RC types don't fully resolve dynamic prop unions through TamaDefer.
  // These props are valid at runtime — the type assertions work around RC type gaps.
  const bgColor = (
    variant === 'outline' ? 'transparent' : variant === 'secondary' ? '$color6' : '$color8'
  ) as '$color8'
  const fgColor = (variant === 'outline' ? '$color' : '$color1') as '$color1'

  const resolvedIcon = loading ? (
    <Spinner color={variant === 'primary' ? '$color1' : '$color'} />
  ) : (
    (icon ?? undefined)
  )

  const content = (
    <TamaguiButton
      minHeight={48}
      minWidth={48}
      borderRadius={100_000}
      pressStyle={{ opacity: 0.9, scale: 0.97 }}
      backgroundColor={bgColor}
      borderWidth={variant === 'outline' ? 1.5 : 0}
      borderColor={variant === 'outline' ? '$color' : undefined}
      marginTop={marginTop as number | undefined}
      disabled={isDisabled}
      opacity={isDisabled ? 0.5 : 1}
      onPress={() => {
        if (!isDisabled && onPress) onPress()
      }}
      icon={resolvedIcon}
      // @ts-expect-error — Tamagui v2 RC: Button extends Stack so `color` isn't in the type, but it works at runtime
      color={fgColor}
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
    >
      {loading ? '' : label}
    </TamaguiButton>
  )

  if (variant === 'primary') {
    return <Theme name="accent">{content}</Theme>
  }

  return content
}
