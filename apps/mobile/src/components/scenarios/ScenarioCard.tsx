import type { ReactNode } from 'react'
import { Theme, XStack, YStack, SizableText } from 'tamagui'
import type { VaultTopic } from '@halo/shared'

export interface ScenarioCardProps {
  topic: VaultTopic
  title: string
  description: string
  icon: ReactNode
  onPress: (topic: VaultTopic) => void
  /** Visually dim + ignore presses while a sibling card is resolving. */
  disabled?: boolean
}

export function ScenarioCard({
  topic,
  title,
  description,
  icon,
  onPress,
  disabled,
}: ScenarioCardProps) {
  return (
    <XStack
      accessible
      accessibilityRole="button"
      accessibilityLabel={`${title} scenario`}
      accessibilityHint="Starts a new conversation for this scenario"
      accessibilityState={{ disabled: !!disabled }}
      padding="$4"
      borderRadius="$4"
      borderWidth={1.5}
      borderColor="$color5"
      backgroundColor="$color2"
      gap="$3.5"
      alignItems="center"
      opacity={disabled ? 0.5 : 1}
      pressStyle={disabled ? undefined : { opacity: 0.85 }}
      onPress={disabled ? undefined : () => onPress(topic)}
    >
      <Theme name="accent">
        <YStack
          width={48}
          height={48}
          borderRadius="$6"
          backgroundColor="$color4"
          alignItems="center"
          justifyContent="center"
        >
          {icon}
        </YStack>
      </Theme>
      <YStack flex={1} gap="$0.5">
        <SizableText size="$6" fontWeight="600" color="$color">
          {title}
        </SizableText>
        <SizableText size="$3" color="$color10">
          {description}
        </SizableText>
      </YStack>
    </XStack>
  )
}
