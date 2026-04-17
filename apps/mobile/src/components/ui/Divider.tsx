import { Separator, XStack, SizableText } from 'tamagui'

export interface DividerProps {
  label?: string
}

export function Divider({ label }: DividerProps) {
  if (!label) {
    return <Separator marginVertical="$2" borderColor="$color4" />
  }

  return (
    <XStack alignItems="center" marginVertical="$2">
      <Separator flex={1} borderColor="$color6" />
      <SizableText marginHorizontal="$2" color="$color6" size="$3">
        {label}
      </SizableText>
      <Separator flex={1} borderColor="$color6" />
    </XStack>
  )
}
