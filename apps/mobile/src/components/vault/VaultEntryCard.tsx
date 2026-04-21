import { useState } from 'react'
import { Trash2 } from '@tamagui/lucide-icons'
import { SizableText, XStack, YStack } from 'tamagui'
import type { VaultEntryListItem } from '@halo/shared'
import { ConfirmDialog } from '../ui/ConfirmDialog'

export interface VaultEntryCardProps {
  entry: VaultEntryListItem
  onDelete: (id: string) => void
}

const PILL_BORDER_RADIUS = 999

function TopicBadge({ topic }: { topic: string }) {
  return (
    <YStack
      paddingHorizontal="$2"
      paddingVertical="$1"
      borderRadius={PILL_BORDER_RADIUS}
      backgroundColor="$color3"
    >
      <SizableText size="$1" color="$color10">
        {topic}
      </SizableText>
    </YStack>
  )
}

export function VaultEntryCard({ entry, onDelete }: VaultEntryCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)

  const isFailed = 'decryptionFailed' in entry
  const subject = isFailed ? '(decryption failed)' : entry.content.subject
  const notes = isFailed ? null : entry.content.notes
  const topicLabel = isFailed ? entry.rawTopic : entry.topic

  return (
    <YStack
      gap="$1.5"
      paddingVertical="$3"
      paddingHorizontal="$3"
      borderRadius="$4"
      backgroundColor="$color2"
    >
      <XStack alignItems="flex-start" gap="$2">
        <YStack flex={1} gap="$1">
          <SizableText
            size="$5"
            fontWeight="600"
            color={isFailed ? '$color9' : '$color12'}
          >
            {subject}
          </SizableText>
          {notes && (
            <SizableText size="$3" color="$color10">
              {notes}
            </SizableText>
          )}
        </YStack>
        <XStack
          accessibilityRole="button"
          accessibilityLabel="Delete memory"
          padding="$2"
          pressStyle={{ opacity: 0.6 }}
          onPress={() => setConfirmOpen(true)}
        >
          <Trash2 size={18} color="$color9" />
        </XStack>
      </XStack>
      <XStack gap="$2" alignItems="center" marginTop="$1">
        <TopicBadge topic={topicLabel} />
      </XStack>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete this memory?"
        description="Halo will stop using it in recommendations. This can't be undone from the app."
        confirmLabel="Delete"
        onConfirm={() => {
          onDelete(entry.id)
          setConfirmOpen(false)
        }}
      />
    </YStack>
  )
}
