import Svg, { Path } from 'react-native-svg'

interface GoogleIconProps {
  size?: number
}

export function GoogleIcon({ size = 20 }: GoogleIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z"
        fill="#4285F4"
      />
      <Path
        d="M3.2 14.1l7 5.1C12.3 14.7 17.7 11 24 11c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 14.9 2 7.2 7.1 3.2 14.1z"
        fill="#EA4335"
      />
      <Path
        d="M24 46c5.4 0 10.3-1.8 14.1-5l-6.9-5.7C29.1 37 26.7 37.8 24 37.8c-6 0-11.1-4-12.9-9.5l-7.1 5.5C7.9 41.1 15.4 46 24 46z"
        fill="#34A853"
      />
      <Path
        d="M44.5 20H24v8.5h11.8c-1 3-3 5.5-5.6 7.2l6.9 5.7C40.9 37.9 46 31.6 46 24c0-1.3-.2-2.7-.5-4z"
        fill="#FBBC05"
      />
    </Svg>
  )
}
