import { YStack, SizableText } from 'tamagui'

/** Large border radius for pill-shaped elements */
const PILL_BORDER_RADIUS = 999

export interface ChipProps {
  label: string
  selected: boolean
  onPress: () => void
}

export function Chip({ label, selected, onPress }: ChipProps) {
  return (
    <YStack
      paddingHorizontal="$3.5"
      paddingVertical="$2"
      borderRadius={PILL_BORDER_RADIUS}
      borderWidth={1.5}
      borderColor={selected ? '$accent7' : '$color5'}
      backgroundColor={selected ? '$accent4' : '$color2'}
      minHeight={48}
      alignItems="center"
      justifyContent="center"
      pressStyle={{ opacity: 0.85 }}
      onPress={onPress}
      accessible
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
    >
      <SizableText
        size="$3"
        fontWeight={selected ? '600' : '500'}
        color={selected ? '$accent11' : '$color'}
      >
        {label}
      </SizableText>
    </YStack>
  )
}
