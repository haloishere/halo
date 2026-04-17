import Svg, { Path } from 'react-native-svg'
import { useTheme } from 'tamagui'

interface BackIconProps {
  size?: number
}

export function BackIcon({ size = 20 }: BackIconProps) {
  const theme = useTheme()
  // color11 always resolves in Tamagui's 12-step scale; non-null assertion is safe
  const color = theme.color11!.val

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 18l-6-6 6-6"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}
