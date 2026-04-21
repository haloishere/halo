import { ScrollView } from 'react-native'
import { H2, Paragraph, Spinner, YStack } from 'tamagui'
import type { VaultEntryListItem, VaultTopic } from '@halo/shared'
import { AnimatedScreen } from '../../src/components/ui'
import { VaultTopicSection } from '../../src/components/vault/VaultTopicSection'
import { useDeleteVaultEntryMutation, useVaultEntriesQuery } from '../../src/api/vault'

interface TopicGroup {
  topic: VaultTopic
  title: string
  emptyHint: string
}

const TOPIC_GROUPS: readonly TopicGroup[] = [
  {
    topic: 'food_and_restaurants',
    title: 'Food & Restaurants',
    emptyHint: "Halo hasn't learned your food preferences yet. Start a Food scenario to teach it.",
  },
  {
    topic: 'fashion',
    title: 'Fashion',
    emptyHint: "Halo hasn't learned your style yet. Start a Fashion scenario to teach it.",
  },
  {
    topic: 'lifestyle_and_travel',
    title: 'Lifestyle & Travel',
    emptyHint: "Halo hasn't learned your lifestyle yet. Start a Lifestyle scenario to teach it.",
  },
]

function TopicSection({ topic, title, emptyHint }: TopicGroup) {
  const { data, isLoading, isError } = useVaultEntriesQuery({ topic })
  const deleteMut = useDeleteVaultEntryMutation()

  const entries: VaultEntryListItem[] = data ?? []

  return (
    <YStack gap="$2">
      {isLoading && <Spinner />}
      {isError && (
        <Paragraph size="$3" color="$red10">
          Couldn&apos;t load {title}. Pull down to retry.
        </Paragraph>
      )}
      {!isLoading && !isError && (
        <VaultTopicSection
          title={title}
          entries={entries}
          onDelete={(id) => deleteMut.mutate(id)}
          emptyHint={emptyHint}
        />
      )}
    </YStack>
  )
}

export default function VaultScreen() {
  return (
    <AnimatedScreen>
      <YStack flex={1} backgroundColor="$background">
        <YStack paddingHorizontal="$5" paddingTop="$4" gap="$2" marginBottom="$3">
          <H2 size="$8">Your Portrait</H2>
          <Paragraph size="$3" color="$color10">
            What Halo knows about you, grouped by scenario. Only Halo&apos;s agent can read this. Every access is logged.
          </Paragraph>
        </YStack>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32, gap: 24 }}
        >
          {TOPIC_GROUPS.map((g) => (
            <TopicSection key={g.topic} {...g} />
          ))}
        </ScrollView>
      </YStack>
    </AnimatedScreen>
  )
}
