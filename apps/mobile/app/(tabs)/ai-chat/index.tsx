/**
 * Scenarios tab entry — three-card picker.
 *
 * Two-phase tap (Phase A): tapping a card checks whether the topic's vault
 * is empty. Empty → routes to `/questionnaire/:topic` so the user fills in
 * their preferences first. Non-empty → creates a conversation and pushes to
 * `/ai-chat/<id>` directly. A conversation's topic is immutable and scopes
 * which vault entries the agent sees — picking the scenario BEFORE typing is
 * the product contract.
 */
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { router, useLocalSearchParams } from 'expo-router'
import { H2, Paragraph, Spinner, XStack, YStack } from 'tamagui'
import { ShoppingBag, Sparkles, Utensils } from '@tamagui/lucide-icons'
import type { VaultTopic } from '@halo/shared'
import { TOPIC_LABELS } from '@halo/shared'
import { AnimatedScreen } from '../../../src/components/ui'
import { ScenarioCard } from '../../../src/components/scenarios/ScenarioCard'
import { useCreateConversation } from '../../../src/api/ai-chat'
import { useVaultEntriesQuery } from '../../../src/api/vault'

interface ScenarioDef {
  topic: VaultTopic
  description: string
  icon: ReactNode
}

const SCENARIOS: readonly ScenarioDef[] = [
  {
    topic: 'food_and_restaurants',
    description: 'Dinners, lunches, places worth the trip',
    icon: <Utensils size={24} color="$accent10" />,
  },
  {
    topic: 'fashion',
    description: 'Outfits and pieces that match your style',
    icon: <ShoppingBag size={24} color="$accent10" />,
  },
  {
    topic: 'lifestyle_and_travel',
    description: 'Places, routines, plans worth making',
    icon: <Sparkles size={24} color="$accent10" />,
  },
]

const VALID_TOPICS = new Set<string>(['food_and_restaurants', 'fashion', 'lifestyle_and_travel'])

export default function ScenariosPicker() {
  const { prompt, topic: topicParam } = useLocalSearchParams<{ prompt?: string; topic?: string }>()
  const incomingTopic: VaultTopic | null =
    topicParam && VALID_TOPICS.has(topicParam) ? (topicParam as VaultTopic) : null

  const createConversation = useCreateConversation()
  // Pre-fetch all three topics so the two-phase check is instant on tap.
  // React hook rules prohibit calling hooks in a loop, so each call is explicit.
  const foodEntries = useVaultEntriesQuery({ topic: 'food_and_restaurants' })
  const fashionEntries = useVaultEntriesQuery({ topic: 'fashion' })
  const lifestyleEntries = useVaultEntriesQuery({ topic: 'lifestyle_and_travel' })
  const vaultByTopic: Record<VaultTopic, typeof foodEntries> = {
    food_and_restaurants: foodEntries,
    fashion: fashionEntries,
    lifestyle_and_travel: lifestyleEntries,
  }

  // Synchronous latch — `createConversation.isPending` flips async via React
  // state; two rapid taps on different cards can fire both before either
  // settles. A ref-based lock closes that window deterministically.
  const pickingRef = useRef(false)
  const [pendingTopic, setPendingTopic] = useState<VaultTopic | null>(null)

  const handlePick = async (topic: VaultTopic, chipPrompt?: string) => {
    if (pickingRef.current) return
    pickingRef.current = true
    setPendingTopic(topic)
    try {
      // Two-phase: empty vault → questionnaire first; non-empty → chat directly.
      // Return early while the topic is still loading — data === undefined is not
      // "empty"; routing to the questionnaire would misfire for users who have entries.
      const { data: topicData, isLoading: topicLoading } = vaultByTopic[topic]
      if (topicLoading) return
      if (!topicData?.length) {
        router.push(`/questionnaire/${topic}`)
        return
      }
      const conv = await createConversation.mutateAsync({ topic })
      if (conv?.id) {
        const dest = chipPrompt
          ? `/ai-chat/${conv.id}?prompt=${encodeURIComponent(chipPrompt)}`
          : `/ai-chat/${conv.id}`
        router.push(dest)
      }
    } catch (err) {
      // Don't swallow silently — the banner below reads
      // `createConversation.error`, and __DEV__ logs for the dev loop.
      if (__DEV__) console.warn('[ScenariosPicker] create failed', err)
    } finally {
      pickingRef.current = false
      setPendingTopic(null)
    }
  }

  // When a home-screen chip carries a topic, skip manual selection and
  // auto-trigger the pick. We wait until vault data has settled (not
  // loading) to avoid the misfire guard inside handlePick returning early.
  // Track the last-handled key so re-entering the screen with a NEW chip
  // tap always fires, while duplicate param renders are ignored.
  const lastHandledKeyRef = useRef<string | null>(null)
  useEffect(() => {
    if (!incomingTopic) return
    const key = `${incomingTopic}:${prompt ?? ''}`
    if (lastHandledKeyRef.current === key) return
    const { isLoading } = vaultByTopic[incomingTopic]
    if (isLoading) return
    lastHandledKeyRef.current = key
    void handlePick(incomingTopic, prompt)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingTopic, prompt, vaultByTopic[incomingTopic ?? 'food_and_restaurants'].isLoading])

  return (
    <AnimatedScreen>
      <YStack
        flex={1}
        backgroundColor="$background"
        paddingHorizontal="$5"
        paddingTop="$4"
        gap="$4"
      >
        <YStack gap="$2">
          <H2 size="$8">Pick a scenario</H2>
          <Paragraph size="$3" color="$color10">
            Halo keeps each scenario&apos;s memories separate. Pick the one that matches what you
            want help with.
          </Paragraph>
        </YStack>

        {createConversation.isError && (
          <XStack
            accessibilityRole="alert"
            backgroundColor="$red2"
            borderColor="$red7"
            borderWidth={1}
            borderRadius="$4"
            padding="$3"
          >
            <Paragraph size="$3" color="$red11" flex={1}>
              Couldn&apos;t start a scenario. {createConversation.error?.message ?? 'Try again.'}
            </Paragraph>
          </XStack>
        )}

        <YStack gap="$3" marginTop="$2">
          {SCENARIOS.map((s) => {
            const isPending = pendingTopic === s.topic
            return (
              <ScenarioCard
                key={s.topic}
                topic={s.topic}
                title={TOPIC_LABELS[s.topic]}
                description={s.description}
                icon={isPending ? <Spinner size="small" color="$accent10" /> : s.icon}
                disabled={pendingTopic !== null}
                onPress={handlePick}
              />
            )
          })}
        </YStack>
      </YStack>
    </AnimatedScreen>
  )
}
