import { ScrollView } from 'react-native'
import { H2, Paragraph, Spinner, YStack } from 'tamagui'
import type { VaultEntryListItem, VaultTopic } from '@halo/shared'
import { TOPIC_LABELS, VAULT_TOPICS } from '@halo/shared'
import { AnimatedScreen, Button } from '../../src/components/ui'
import { VaultTopicSection } from '../../src/components/vault/VaultTopicSection'
import { useDeleteVaultEntryMutation, useVaultEntriesQuery } from '../../src/api/vault'

// Human-facing description strings per topic, kept here (not in `TOPIC_LABELS`)
// because these read like UI copy, not wire-contract labels. Keep terse —
// they only appear in Portrait's empty states.
const TOPIC_EMPTY_HINTS: Record<VaultTopic, string> = {
  food_and_restaurants:
    "Halo hasn't learned your food preferences yet. Start a Food scenario to teach it.",
  fashion: "Halo hasn't learned your style yet. Start a Fashion scenario to teach it.",
  lifestyle_and_travel:
    "Halo hasn't learned your lifestyle yet. Start a Lifestyle scenario to teach it.",
}

interface TopicSectionProps {
  topic: VaultTopic
  onDelete: (payload: { id: string; topic: VaultTopic }) => void
  deleteError: Error | null
}

function TopicSection({ topic, onDelete, deleteError }: TopicSectionProps) {
  const { data, isLoading, isError, refetch } = useVaultEntriesQuery({ topic })
  const title = TOPIC_LABELS[topic]
  const entries: VaultEntryListItem[] = data ?? []

  if (isLoading) {
    return (
      <YStack paddingVertical="$6" alignItems="center">
        <Spinner size="small" color="$accent9" />
      </YStack>
    )
  }

  if (isError) {
    return (
      <YStack gap="$2">
        <Paragraph size="$3" color="$red10">
          Couldn&apos;t load {title}.
        </Paragraph>
        <Button
          variant="outline"
          label="Try again"
          onPress={() => {
            void refetch()
          }}
        />
      </YStack>
    )
  }

  return (
    <YStack gap="$2">
      <VaultTopicSection
        title={title}
        entries={entries}
        onDelete={onDelete}
        emptyHint={TOPIC_EMPTY_HINTS[topic]}
      />
      {deleteError && (
        <Paragraph size="$2" color="$red10">
          Couldn&apos;t delete that memory: {deleteError.message}
        </Paragraph>
      )}
    </YStack>
  )
}

export default function VaultScreen() {
  // Single mutation owned by the screen — delete errors surface in the
  // topic section that initiated the delete, via the shared `deleteError`
  // state. Previously each `TopicSection` owned its own mutation, and
  // errors were un-observed (per Phase-4 re-review N4).
  const deleteMut = useDeleteVaultEntryMutation()
  const handleDelete = (payload: { id: string; topic: VaultTopic }) => {
    deleteMut.mutate(payload)
  }

  // Only surface the error on the topic section that attempted the delete.
  const errorTopic = deleteMut.isError ? (deleteMut.variables?.topic ?? null) : null

  return (
    <AnimatedScreen>
      <YStack flex={1} backgroundColor="$background">
        <YStack paddingHorizontal="$5" paddingTop="$4" gap="$2" marginBottom="$3">
          <H2 size="$8">Your Portrait</H2>
          <Paragraph size="$3" color="$color10">
            What Halo knows about you, grouped by scenario. Only Halo&apos;s agent can read this.
            Every access is logged.
          </Paragraph>
        </YStack>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32, gap: 24 }}
        >
          {VAULT_TOPICS.map((topic) => (
            <TopicSection
              key={topic}
              topic={topic}
              onDelete={handleDelete}
              deleteError={errorTopic === topic ? (deleteMut.error ?? null) : null}
            />
          ))}
        </ScrollView>
      </YStack>
    </AnimatedScreen>
  )
}
