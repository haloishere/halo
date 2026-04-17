import { useColorScheme } from 'react-native'
import { XStack, SizableText, Switch } from 'tamagui'
import { useThemeStore } from '../../stores/theme'

export function ThemeIconToggle() {
  const systemScheme = useColorScheme()
  const { mode, setMode } = useThemeStore()

  const isDark = mode === 'system' ? systemScheme === 'dark' : mode === 'dark'

  function handleToggle(checked: boolean) {
    setMode(checked ? 'dark' : 'light')
  }

  return (
    <XStack alignItems="center" gap="$2">
      <SizableText size="$3" color="$color8">
        ☀
      </SizableText>
      <Switch
        size="$3"
        checked={isDark}
        onCheckedChange={handleToggle}
        backgroundColor={isDark ? '$accent7' : '$color5'}
        accessible
        accessibilityRole="switch"
        accessibilityLabel={isDark ? 'Dark mode on' : 'Light mode on'}
      >
        <Switch.Thumb backgroundColor="$color1" transition="bouncy" />
      </Switch>
      <SizableText size="$3" color="$color8">
        ☾
      </SizableText>
    </XStack>
  )
}
