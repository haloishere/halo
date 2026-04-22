import { ScrollView } from 'react-native'
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated'
import { Paragraph, SizableText, Spinner, YStack } from 'tamagui'
import { Globe, Gem, Utensils } from '@tamagui/lucide-icons'
import { router } from 'expo-router'
import type { VaultEntryListItem, VaultTopic } from '@halo/shared'
import { TOPIC_LABELS, VAULT_TOPICS } from '@halo/shared'
import { AnimatedScreen, Button } from '../../src/components/ui'
import { VaultTopicSection } from '../../src/components/vault/VaultTopicSection'
import { useDeleteVaultEntryMutation, useVaultEntriesQuery } from '../../src/api/vault'

const TOPIC_EMPTY_HINTS: Record<VaultTopic, string> = {
  food_and_restaurants:
    "Halo hasn't learned your food preferences yet. Start a Food scenario to teach it.",
  fashion: "Halo hasn't learned your style yet. Start a Fashion scenario to teach it.",
  lifestyle_and_travel:
    "Halo hasn't learned your lifestyle yet. Start a Lifestyle scenario to teach it.",
}

const TOPIC_ICONS: Record<VaultTopic, React.ReactNode> = {
  food_and_restaurants: <Utensils size={18} color="$accent9" />,
  fashion: <Gem size={18} color="$accent9" />,
  lifestyle_and_travel: <Globe size={18} color="$accent9" />,
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

  const quickFillCTA = (
    <Button
      variant="primary"
      label="Quick-fill"
      accessibilityLabel={`Quick-fill ${title}`}
      onPress={() => router.push(`/questionnaire/${topic}`)}
    />
  )

  return (
    <YStack gap="$2">
      <VaultTopicSection
        title={title}
        entries={entries}
        onDelete={onDelete}
        emptyHint={TOPIC_EMPTY_HINTS[topic]}
        quickFillCTA={quickFillCTA}
        icon={TOPIC_ICONS[topic]}
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
  const deleteMut = useDeleteVaultEntryMutation()
  const handleDelete = (payload: { id: string; topic: VaultTopic }) => {
    deleteMut.mutate(payload)
  }

  const errorTopic = deleteMut.isError ? (deleteMut.variables?.topic ?? null) : null

  return (
    <AnimatedScreen>
      <YStack flex={1} backgroundColor="$background">
        <Animated.View entering={FadeIn.duration(600)}>
          <YStack paddingHorizontal="$5" paddingTop="$5" paddingBottom="$4">
            <SizableText size="$2" color="$color9" letterSpacing={0.4}>
              What Halo knows about you. Only its agent can read this.{' '}
              <SizableText size="$2" color="$accent9" fontWeight="600">
                Every access is logged.
              </SizableText>
            </SizableText>
          </YStack>
        </Animated.View>

        {/* ── Topic cards with staggered entrance ────────── */}
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 16 }}
          showsVerticalScrollIndicator={false}
        >
          {VAULT_TOPICS.map((topic, idx) => (
            <Animated.View
              key={topic}
              entering={FadeInDown.delay(idx * 150)
                .springify()
                .damping(22)}
            >
              <TopicSection
                topic={topic}
                onDelete={handleDelete}
                deleteError={errorTopic === topic ? (deleteMut.error ?? null) : null}
              />
            </Animated.View>
          ))}
        </ScrollView>
      </YStack>
    </AnimatedScreen>
  )
}
