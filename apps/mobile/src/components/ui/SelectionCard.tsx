import { YStack, SizableText } from 'tamagui'

export interface SelectionCardProps {
  title: string
  description?: string
  selected: boolean
  onPress: () => void
  accessibilityRole?: 'radio' | 'checkbox'
}

export function SelectionCard({
  title,
  description,
  selected,
  onPress,
  accessibilityRole = 'radio',
}: SelectionCardProps) {
  return (
    <YStack
      padding="$3.5"
      borderRadius="$4"
      borderWidth={1.5}
      borderColor={selected ? '$accent7' : '$color5'}
      backgroundColor={selected ? '$accent4' : '$color2'}
      minHeight={56}
      justifyContent="center"
      pressStyle={{ opacity: 0.85 }}
      onPress={onPress}
      accessible
      accessibilityRole={accessibilityRole}
      accessibilityState={{ selected }}
    >
      <SizableText
        size="$5"
        fontWeight={selected ? '600' : '500'}
        color={selected ? '$accent11' : '$color'}
      >
        {title}
      </SizableText>
      {description && (
        <SizableText size="$3" color="$color8" marginTop="$1.5">
          {description}
        </SizableText>
      )}
    </YStack>
  )
}
