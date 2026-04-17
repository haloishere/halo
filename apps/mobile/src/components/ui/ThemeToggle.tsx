import { YStack, XStack, SizableText } from 'tamagui'
import { useThemeStore, type ThemeMode } from '../../stores/theme'

const options: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

export function ThemeToggle() {
  const { mode, setMode } = useThemeStore()

  return (
    <YStack gap="$1.5">
      <SizableText size="$3" fontWeight="500" color="$color">
        Appearance
      </SizableText>
      <XStack backgroundColor="$color3" borderRadius="$4" padding={3}>
        {options.map(({ value, label }) => {
          const isActive = mode === value
          return (
            <YStack
              key={value}
              flex={1}
              paddingVertical="$2"
              alignItems="center"
              borderRadius="$3"
              backgroundColor={isActive ? '$accent7' : 'transparent'}
              onPress={() => setMode(value)}
              cursor="pointer"
              accessible
              accessibilityRole="radio"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`${label} theme`}
            >
              <SizableText
                size="$3"
                fontWeight={isActive ? '600' : '400'}
                color={isActive ? '$color1' : '$color'}
              >
                {label}
              </SizableText>
            </YStack>
          )
        })}
      </XStack>
    </YStack>
  )
}
