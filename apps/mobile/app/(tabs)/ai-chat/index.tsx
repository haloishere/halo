/**
 * Scenarios tab entry — three-card picker.
 *
 * Phase 4: replaces the auto-`<Redirect>` to the last-active chat. Tapping a
 * card creates a new conversation with that topic (required since migration
 * 0012) and pushes to `/ai-chat/<id>`. A conversation's topic is immutable
 * for its lifetime and scopes which vault entries the agent sees — picking
 * the scenario BEFORE typing is the product contract.
 */
import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { router } from 'expo-router'
import { H2, Paragraph, Spinner, XStack, YStack } from 'tamagui'
import { ShoppingBag, Sparkles, Utensils } from '@tamagui/lucide-icons'
import type { VaultTopic } from '@halo/shared'
import { TOPIC_LABELS } from '@halo/shared'
import { AnimatedScreen } from '../../../src/components/ui'
import { ScenarioCard } from '../../../src/components/scenarios/ScenarioCard'
import { useCreateConversation } from '../../../src/api/ai-chat'

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

export default function ScenariosPicker() {
  const createConversation = useCreateConversation()
  // Synchronous latch — `createConversation.isPending` flips async via React
  // state; two rapid taps on different cards can fire both before either
  // settles. A ref-based lock closes that window deterministically.
  const pickingRef = useRef(false)
  const [pendingTopic, setPendingTopic] = useState<VaultTopic | null>(null)

  const handlePick = async (topic: VaultTopic) => {
    if (pickingRef.current) return
    pickingRef.current = true
    setPendingTopic(topic)
    try {
      const conv = await createConversation.mutateAsync({ topic })
      if (conv?.id) {
        router.push(`/ai-chat/${conv.id}`)
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

  return (
    <AnimatedScreen>
      <YStack flex={1} backgroundColor="$background" paddingHorizontal="$5" paddingTop="$4" gap="$4">
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
