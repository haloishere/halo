import { Separator, SizableText, XStack, YStack } from 'tamagui'
import type { VaultEntryListItem } from '@halo/shared'
import { VaultEntryCard } from './VaultEntryCard'

export interface VaultTopicSectionProps {
  title: string
  entries: VaultEntryListItem[]
  onDelete: (id: string) => void
  emptyHint?: string
}

export function VaultTopicSection({ title, entries, onDelete, emptyHint }: VaultTopicSectionProps) {
  return (
    <YStack gap="$2.5">
      <XStack alignItems="baseline" gap="$2">
        <SizableText size="$6" fontWeight="600" color="$color12">
          {title}
        </SizableText>
        {entries.length > 0 && (
          <SizableText size="$3" color="$color9">
            {entries.length}
          </SizableText>
        )}
      </XStack>

      {entries.length === 0 ? (
        emptyHint && (
          <SizableText size="$3" color="$color9" fontStyle="italic">
            {emptyHint}
          </SizableText>
        )
      ) : (
        <YStack gap="$2">
          {entries.map((entry, idx) => (
            <YStack key={entry.id} gap="$2">
              {idx > 0 && <Separator />}
              <VaultEntryCard entry={entry} onDelete={onDelete} />
            </YStack>
          ))}
        </YStack>
      )}
    </YStack>
  )
}
