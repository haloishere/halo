/**
 * Scenarios tab entry — three-card picker.
 *
 * Previously: an auto-`<Redirect>` to the last-active chat. That behaviour
 * is gone: Phase 4 of Personal Memory makes the tab a topic picker.
 * Tapping a card creates a new conversation with that topic (which the
 * API requires since migration 0012) and pushes to `/ai-chat/<id>`.
 *
 * A conversation's `topic` is immutable for its lifetime and scopes which
 * vault entries the agent sees. Picking the scenario BEFORE typing is the
 * product contract — the model's prompt is pre-filtered and the proposal
 * it emits is topic-tagged accordingly. Resume via History can be added
 * later; V1 ships intentionally bare so the picker can't be missed.
 */
import type { ReactNode } from 'react'
import { router } from 'expo-router'
import { H2, Paragraph, YStack } from 'tamagui'
import { ShoppingBag, Sparkles, Utensils } from '@tamagui/lucide-icons'
import type { VaultTopic } from '@halo/shared'
import { AnimatedScreen } from '../../../src/components/ui'
import { ScenarioCard } from '../../../src/components/scenarios/ScenarioCard'
import { useCreateConversation } from '../../../src/api/ai-chat'

interface ScenarioDef {
  topic: VaultTopic
  title: string
  description: string
  icon: ReactNode
}

const SCENARIOS: readonly ScenarioDef[] = [
  {
    topic: 'food_and_restaurants',
    title: 'Food & Restaurants',
    description: 'What to eat, where to go, what fits your taste',
    icon: <Utensils size={24} color="$accent10" />,
  },
  {
    topic: 'fashion',
    title: 'Fashion',
    description: 'Outfits and pieces that match your style',
    icon: <ShoppingBag size={24} color="$accent10" />,
  },
  {
    topic: 'lifestyle_and_travel',
    title: 'Lifestyle & Travel',
    description: 'Places, routines, plans worth making',
    icon: <Sparkles size={24} color="$accent10" />,
  },
]

export default function ScenariosPicker() {
  const createConversation = useCreateConversation()

  const handlePick = async (topic: VaultTopic) => {
    if (createConversation.isPending) return
    try {
      const conv = await createConversation.mutateAsync({ topic })
      if (conv?.id) router.push(`/ai-chat/${conv.id}`)
    } catch {
      // Error surfaces via React Query state — picker stays mounted so the
      // user can retry. Toast wrapping arrives when we have one.
    }
  }

  return (
    <AnimatedScreen>
      <YStack flex={1} backgroundColor="$background" paddingHorizontal="$5" paddingTop="$4" gap="$4">
        <YStack gap="$2">
          <H2 size="$8">Pick a scenario</H2>
          <Paragraph size="$3" color="$color10">
            Halo keeps each scenario&apos;s memories separate. Pick the one that matches what you want help with.
          </Paragraph>
        </YStack>

        <YStack gap="$3" marginTop="$2">
          {SCENARIOS.map((s) => (
            <ScenarioCard
              key={s.topic}
              topic={s.topic}
              title={s.title}
              description={s.description}
              icon={s.icon}
              onPress={handlePick}
            />
          ))}
        </YStack>
      </YStack>
    </AnimatedScreen>
  )
}
