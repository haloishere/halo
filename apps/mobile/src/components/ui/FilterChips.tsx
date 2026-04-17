import { ScrollView, XStack, SizableText } from 'tamagui'

const PILL_BORDER_RADIUS = 999

interface FilterChipsProps<T extends string> {
  items: readonly T[]
  selected: T | undefined
  onSelect: (item: T | undefined) => void
  getLabel: (item: T) => string
  /** If true, pressing the selected chip deselects it. Default: true */
  toggleable?: boolean
}

function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string
  selected: boolean
  onPress: () => void
}) {
  return (
    <XStack
      paddingHorizontal="$3"
      paddingVertical="$3"
      borderRadius={PILL_BORDER_RADIUS}
      borderWidth={1}
      borderColor={selected ? '$accent7' : '$color5'}
      backgroundColor={selected ? '$accent4' : '$color2'}
      alignItems="center"
      justifyContent="center"
      pressStyle={{ opacity: 0.85 }}
      onPress={onPress}
      accessible
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
    >
      <SizableText
        size="$2"
        fontWeight={selected ? '600' : '500'}
        color={selected ? '$accent11' : '$color'}
      >
        {label}
      </SizableText>
    </XStack>
  )
}

export function FilterChips<T extends string>({
  items,
  selected,
  onSelect,
  getLabel,
  toggleable = true,
}: FilterChipsProps<T>) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} flexGrow={0} flexShrink={0}>
      <XStack gap="$2" paddingVertical="$2" paddingHorizontal="$4" alignItems="center">
        <FilterChip
          label="All"
          selected={selected === undefined}
          onPress={() => onSelect(undefined)}
        />
        {items.map((item) => {
          const isSelected = selected === item
          return (
            <FilterChip
              key={item}
              label={getLabel(item)}
              selected={isSelected}
              onPress={() => onSelect(toggleable && isSelected ? undefined : item)}
            />
          )
        })}
      </XStack>
    </ScrollView>
  )
}
