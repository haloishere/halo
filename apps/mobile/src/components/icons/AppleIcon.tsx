import Svg, { Path } from 'react-native-svg'
import { useTheme } from 'tamagui'

interface AppleIconProps {
  size?: number
}

export function AppleIcon({ size = 20 }: AppleIconProps) {
  const theme = useTheme()
  const color = theme.color?.val ?? '#000'

  return (
    <Svg width={size} height={size} viewBox="0 0 384 512">
      <Path
        d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-27.1-46.9-42.6-83.7-46.5-34.8-3.7-72.7 20.7-86.7 20.7-14.8 0-48.3-19.5-72.2-19.5C73.6 139.5 0 182.1 0 268c0 26.6 4.8 54.1 14.5 82.4C26.7 384.8 79.3 512 134.3 512c23.3-.4 39.7-16.3 69.3-16.3 28.7 0 43.8 16.3 69.6 16.3C329.2 511 375 393.3 384 359.7c-56.8-26.5-65.3-101.9-65.3-91zM245.7 49.8c23.4-28.4 21.6-54.3 20.9-64.2-21 1.3-45.5 14.5-59.7 31.5-15.8 18.8-25 42.1-23 66.7 22.9 1.7 46.3-12.5 61.8-34z"
        fill={color}
      />
    </Svg>
  )
}
