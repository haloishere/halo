import type { ReactNode } from 'react'
import { Spinner, SizableText, YStack } from 'tamagui'

export interface EmptyStateProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: (props: any) => ReactNode
  title: string
  subtitle?: string
  isLoading?: boolean
}

export function EmptyState({ icon: Icon, title, subtitle, isLoading }: EmptyStateProps) {
  if (isLoading) {
    return (
      <YStack alignItems="center" paddingTop="$8" testID="empty-state-loading">
        <Spinner size="large" color="$accent9" />
      </YStack>
    )
  }

  return (
    <YStack alignItems="center" paddingTop="$8" gap="$3" testID="empty-state">
      <Icon size={48} color="$color6" />
      <SizableText size="$5" color="$color6" fontWeight="600">
        {title}
      </SizableText>
      {subtitle && (
        <SizableText size="$3" color="$color6" textAlign="center">
          {subtitle}
        </SizableText>
      )}
    </YStack>
  )
}
