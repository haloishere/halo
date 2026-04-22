import { useEffect, useRef, useState } from 'react'
import { Redirect, Stack, router, useLocalSearchParams } from 'expo-router'
import { Paragraph, Spinner, XStack, YStack } from 'tamagui'

import type {
  MemoryProposal,
  PreferenceContent,
  Question,
  QuestionnaireAnswers,
  VaultTopic,
} from '@halo/shared'
import { TOPIC_LABELS, VAULT_TOPICS } from '@halo/shared'
import { AnimatedScreen, Button, ProgressBar, ScreenContainer } from '../../src/components/ui'
import { HeaderBar } from '../../src/components/ui/HeaderBar'
import { QuestionCard } from '../../src/components/scenarios/QuestionCard'
import { ProposalReviewRow } from '../../src/components/scenarios/ProposalReviewRow'
import {
  useQuestionnaireQuery,
  useQuestionnaireFollowupsMutation,
  useSubmitQuestionnaireMutation,
} from '../../src/api/scenarios'
import { useCreateVaultEntryMutation, useClearVaultTopicMutation } from '../../src/api/vault'

type Phase = 'questions' | 'review'

const CATEGORY_BY_TOPIC: Record<VaultTopic, PreferenceContent['category']> = {
  food_and_restaurants: 'food',
  fashion: 'lifestyle',
  lifestyle_and_travel: 'lifestyle',
}

export default function QuestionnaireScreen() {
  const { topic } = useLocalSearchParams<{ topic: string }>()

  const safeTopic = VAULT_TOPICS.includes(topic as VaultTopic) ? (topic as VaultTopic) : null
  if (!safeTopic) {
    return <Redirect href="/(tabs)/ai-chat" />
  }

  return <QuestionnaireFlow topic={safeTopic} />
}

function QuestionnaireFlow({ topic }: { topic: VaultTopic }) {
  const { data, isLoading, isError, refetch } = useQuestionnaireQuery(topic)

  const [followupQuestions, setFollowupQuestions] = useState<Question[]>([])
  const allQuestions = [...(data?.questions ?? []), ...followupQuestions]

  const [answers, setAnswers] = useState<QuestionnaireAnswers>({})
  const [stepIndex, setStepIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('questions')
  const [proposals, setProposals] = useState<MemoryProposal[]>([])
  const [selectedLabels, setSelectedLabels] = useState<Set<string>>(new Set())
  const [saveError, setSaveError] = useState<string | null>(null)

  // Prevents double-firing on rapid taps — same pattern as the scenario picker.
  const continuingRef = useRef(false)
  const savingRef = useRef(false)

  const followupsLoaded = followupQuestions.length > 0
  const followupsMut = useQuestionnaireFollowupsMutation(topic)
  const submitMut = useSubmitQuestionnaireMutation(topic)
  const clearTopic = useClearVaultTopicMutation()
  const createEntry = useCreateVaultEntryMutation()

  const currentQuestion = allQuestions[stepIndex]
  const currentAnswer = answers[currentQuestion?.id ?? ''] ?? { chips: [] }
  const baseCount = data?.questions.length ?? 0
  const isOnFollowup = followupsLoaded && stepIndex >= baseCount
  const isLastQuestion = stepIndex === allQuestions.length - 1 && allQuestions.length > 0

  function handleAnswerChange(updated: typeof currentAnswer) {
    if (!currentQuestion) return
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: updated }))
  }

  async function handleContinue() {
    if (!currentQuestion || continuingRef.current) return
    continuingRef.current = true
    try {
      const isLastCurated = stepIndex === baseCount - 1

      if (isLastCurated && !followupsLoaded) {
        const res = await followupsMut.mutateAsync(answers)
        if (res.followups.length > 0) {
          setFollowupQuestions(res.followups)
          setStepIndex((s) => s + 1)
        } else {
          await loadProposals()
        }
        return
      }

      if (isOnFollowup || isLastQuestion) {
        await loadProposals()
        return
      }

      setStepIndex((s) => s + 1)
    } finally {
      continuingRef.current = false
    }
  }

  async function loadProposals() {
    const res = await submitMut.mutateAsync(answers)
    setProposals(res.proposals)
    setSelectedLabels(new Set(res.proposals.map((p) => p.label)))
    setPhase('review')
  }

  async function handleSaveSelected() {
    if (savingRef.current) return
    savingRef.current = true
    setSaveError(null)
    try {
      await clearTopic.mutateAsync(topic)
      const toSave = proposals.filter((p) => selectedLabels.has(p.label))
      if (toSave.length > 0) {
        const results = await Promise.allSettled(
          toSave.map((p) =>
            createEntry.mutateAsync({
              type: 'preference',
              topic: p.topic,
              content: {
                category: CATEGORY_BY_TOPIC[p.topic],
                subject: p.label,
                sentiment: 'neutral',
                confidence: 0.9,
                notes: p.value,
              },
            }),
          ),
        )
        // Remove successfully-saved labels so a retry only re-attempts failed ones.
        const savedLabels = new Set(
          toSave.filter((_, i) => results[i]?.status === 'fulfilled').map((p) => p.label),
        )
        setSelectedLabels((prev) => {
          const next = new Set(prev)
          savedLabels.forEach((l) => next.delete(l))
          return next
        })
        const failed = results.filter((r) => r.status === 'rejected').length
        if (failed > 0) {
          setSaveError(`${failed} of ${toSave.length} memories couldn't be saved. Try again.`)
          return
        }
      }
      router.replace('/(tabs)/vault' as never)
    } finally {
      savingRef.current = false
    }
  }

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <AnimatedScreen>
          <YStack flex={1} backgroundColor="$background">
            <HeaderBar showBack title={TOPIC_LABELS[topic]} />
            <YStack flex={1} alignItems="center" justifyContent="center">
              <Spinner size="large" color="$accent9" />
            </YStack>
          </YStack>
        </AnimatedScreen>
      </>
    )
  }

  if (isError || !data) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <AnimatedScreen>
          <YStack flex={1} backgroundColor="$background">
            <HeaderBar showBack title={TOPIC_LABELS[topic]} />
            <ScreenContainer>
              <Paragraph color="$red10" marginBottom="$4">
                Couldn&apos;t load the questionnaire. Check your connection and try again.
              </Paragraph>
              <Button label="Try again" onPress={() => void refetch()} />
            </ScreenContainer>
          </YStack>
        </AnimatedScreen>
      </>
    )
  }

  if (phase === 'review') {
    const saveCount = selectedLabels.size
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <AnimatedScreen>
          <YStack flex={1} backgroundColor="$background">
            <HeaderBar showBack title="Review memories" />
            <ScreenContainer
              footer={
                <YStack gap="$2">
                  {saveError && (
                    <Paragraph size="$2" color="$red10" textAlign="center">
                      {saveError}
                    </Paragraph>
                  )}
                  <Button
                    label={
                      saveCount > 0
                        ? `Save ${saveCount} memor${saveCount === 1 ? 'y' : 'ies'}`
                        : 'Skip all'
                    }
                    onPress={() => void handleSaveSelected()}
                    disabled={createEntry.isPending}
                    loading={createEntry.isPending}
                  />
                </YStack>
              }
            >
              <Paragraph size="$3" color="$color10" marginBottom="$5">
                Halo wants to remember these about you under {TOPIC_LABELS[topic]}. Toggle any
                you&apos;d rather skip.
              </Paragraph>

              <YStack gap="$1">
                {proposals.map((p, idx) => (
                  <ProposalReviewRow
                    key={`${p.label}_${idx}`}
                    proposal={p}
                    selected={selectedLabels.has(p.label)}
                    onToggle={(on) =>
                      setSelectedLabels((prev) => {
                        const next = new Set(prev)
                        if (on) next.add(p.label)
                        else next.delete(p.label)
                        return next
                      })
                    }
                  />
                ))}
              </YStack>
            </ScreenContainer>
          </YStack>
        </AnimatedScreen>
      </>
    )
  }

  const isLoadingNext = followupsMut.isPending || submitMut.isPending

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <AnimatedScreen>
        <YStack flex={1} backgroundColor="$background">
          <HeaderBar showBack title={TOPIC_LABELS[topic]} />
          <ProgressBar
            currentStep={stepIndex + 1}
            totalSteps={Math.max(1, allQuestions.length || baseCount)}
          />
          <ScreenContainer
            footer={
              <Button
                label={isLastQuestion || isOnFollowup ? 'Submit' : 'Continue'}
                onPress={() => void handleContinue()}
                disabled={isLoadingNext}
                loading={isLoadingNext}
              />
            }
          >
            {followupsMut.isError && (
              <XStack
                accessibilityRole="alert"
                backgroundColor="$red2"
                borderColor="$red7"
                borderWidth={1}
                borderRadius="$4"
                padding="$3"
                marginBottom="$4"
              >
                <Paragraph size="$3" color="$red11" flex={1}>
                  Couldn&apos;t load follow-up. {followupsMut.error?.message ?? 'Try again.'}
                </Paragraph>
              </XStack>
            )}

            {submitMut.isError && (
              <XStack
                accessibilityRole="alert"
                backgroundColor="$red2"
                borderColor="$red7"
                borderWidth={1}
                borderRadius="$4"
                padding="$3"
                marginBottom="$4"
              >
                <Paragraph size="$3" color="$red11" flex={1}>
                  Couldn&apos;t generate proposals. {submitMut.error?.message ?? 'Try again.'}
                </Paragraph>
              </XStack>
            )}

            {currentQuestion ? (
              <QuestionCard
                question={currentQuestion}
                answer={currentAnswer}
                onChange={handleAnswerChange}
              />
            ) : (
              <YStack alignItems="center" justifyContent="center" flex={1}>
                <Spinner size="large" color="$accent9" />
              </YStack>
            )}
          </ScreenContainer>
        </YStack>
      </AnimatedScreen>
    </>
  )
}
