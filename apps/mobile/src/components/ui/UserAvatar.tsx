import { Avatar, SizableText } from 'tamagui'
import type { FontSizeTokens, SizeTokens } from 'tamagui'

interface UserAvatarProps {
  name: string
  size?: SizeTokens
}

// Maps avatar size token → fallback initial font size token
const FALLBACK_FONT_SIZE: Partial<Record<SizeTokens, FontSizeTokens>> = {
  $2: '$3',
  $3: '$5',
  $4: '$7',
  $5: '$8',
  $6: '$9',
}

export function UserAvatar({ name, size = '$3' }: UserAvatarProps) {
  const fontSize = FALLBACK_FONT_SIZE[size] ?? '$5'
  return (
    <Avatar circular size={size}>
      <Avatar.Fallback backgroundColor="$accent4" alignItems="center" justifyContent="center">
        <SizableText size={fontSize} fontWeight="700" color="$accent11">
          {(name || '?').charAt(0).toUpperCase()}
        </SizableText>
      </Avatar.Fallback>
    </Avatar>
  )
}
