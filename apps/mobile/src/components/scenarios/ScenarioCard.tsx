import type { ReactNode } from 'react'
import { XStack, YStack, SizableText } from 'tamagui'
import type { VaultTopic } from '@halo/shared'

export interface ScenarioCardProps {
  topic: VaultTopic
  title: string
  description: string
  icon: ReactNode
  onPress: (topic: VaultTopic) => void
}

export function ScenarioCard({ topic, title, description, icon, onPress }: ScenarioCardProps) {
  return (
    <XStack
      accessible
      accessibilityRole="button"
      accessibilityLabel={`${title} scenario`}
      padding="$4"
      borderRadius="$4"
      borderWidth={1.5}
      borderColor="$color5"
      backgroundColor="$color2"
      gap="$3.5"
      alignItems="center"
      pressStyle={{ opacity: 0.85 }}
      onPress={() => onPress(topic)}
    >
      <YStack
        width={48}
        height={48}
        borderRadius="$6"
        backgroundColor="$accent4"
        alignItems="center"
        justifyContent="center"
      >
        {icon}
      </YStack>
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
