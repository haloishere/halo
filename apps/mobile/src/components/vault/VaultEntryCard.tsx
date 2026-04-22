import { useState } from 'react'
import { Trash2 } from '@tamagui/lucide-icons'
import { SizableText, XStack, YStack } from 'tamagui'
import type { VaultEntryListItem, VaultTopic } from '@halo/shared'
import { TOPIC_LABELS, VAULT_TOPICS } from '@halo/shared'
import { ConfirmDialog } from '../ui/ConfirmDialog'

export interface VaultEntryCardProps {
  entry: VaultEntryListItem
  /**
   * Fired on confirmed delete. Receives `{ id, topic }` so the caller can
   * scope cache invalidation to the affected topic. For the `FailedVaultEntry`
   * sentinel variant, `topic` falls back to `'food_and_restaurants'` since the
   * raw topic may be a drifted value that the Zod enum rejects — the delete
   * itself only needs the id.
   */
  onDelete: (payload: { id: string; topic: VaultTopic }) => void
}

const PILL_BORDER_RADIUS = 999

function isKnownTopic(raw: string): raw is VaultTopic {
  return (VAULT_TOPICS as readonly string[]).includes(raw)
}

function TopicBadge({ rawTopic }: { rawTopic: string }) {
  // Accent-tinted to match the header topic badge in `[id].tsx` — one
  // coherent visual language for "what scenario this belongs to" across
  // picker, chat header, and Portrait cards.
  const label = isKnownTopic(rawTopic) ? TOPIC_LABELS[rawTopic] : rawTopic
  return (
    <YStack
      paddingHorizontal="$2"
      paddingVertical="$0.5"
      borderRadius={PILL_BORDER_RADIUS}
      backgroundColor="$accent4"
    >
      <SizableText size="$1" color="$accent11" fontWeight="600">
        {label}
      </SizableText>
    </YStack>
  )
}

export function VaultEntryCard({ entry, onDelete }: VaultEntryCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)

  const isFailed = 'decryptionFailed' in entry
  const subject = isFailed ? '(decryption failed)' : entry.content.subject
  const notes = isFailed ? null : entry.content.notes
  const rawTopic = isFailed ? entry.rawTopic : entry.topic

  const handleConfirm = () => {
    const topic: VaultTopic = isKnownTopic(rawTopic) ? rawTopic : 'food_and_restaurants'
    onDelete({ id: entry.id, topic })
    setConfirmOpen(false)
  }

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
            size="$4"
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
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          pressStyle={{ opacity: 0.6 }}
          onPress={() => setConfirmOpen(true)}
        >
          <Trash2 size={18} color="$color9" />
        </XStack>
      </XStack>
      <XStack gap="$2" alignItems="center" marginTop="$1">
        <TopicBadge rawTopic={rawTopic} />
      </XStack>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete this memory?"
        description="Halo will stop using it in recommendations. This can't be undone from the app."
        confirmLabel="Delete"
        onConfirm={handleConfirm}
      />
    </YStack>
  )
}
