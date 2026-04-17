import { useState } from 'react'
import { Alert } from 'react-native'
import { XStack, Heading, SizableText } from 'tamagui'
import { router, useLocalSearchParams } from 'expo-router'
import { CHALLENGES, DISPLAY_NAME_PATTERN } from '@halo/shared'
import type { Challenge, CaregiverRelationship, DiagnosisStage } from '@halo/shared'
import { useOnboardingMutation } from '../../src/api/users'
import { useAuthStore } from '../../src/stores/auth'
import { Button, Chip, ScreenContainer } from '../../src/components/ui'

const CHALLENGE_LABELS: Record<Challenge, string> = {
  behavioral: 'Behavioral changes',
  communication: 'Communication',
  daily_care: 'Daily care routines',
  self_care: 'My own self-care',
  safety: 'Safety at home',
  legal_financial: 'Legal & financial matters',
  emotional: 'Emotional support',
}

export default function ChallengesScreen() {
  const params = useLocalSearchParams<{
    name?: string
    relationship?: CaregiverRelationship
    diagnosisStage?: DiagnosisStage
  }>()
  const [selected, setSelected] = useState<Challenge[]>([])
  const onboardingMutation = useOnboardingMutation()
  const { setUser, user } = useAuthStore()

  function toggleChallenge(challenge: Challenge) {
    setSelected((prev) =>
      prev.includes(challenge) ? prev.filter((c) => c !== challenge) : [...prev, challenge],
    )
  }

  async function handleFinish() {
    if (selected.length === 0 || !params.relationship || !params.diagnosisStage) return

    const trimmedName = params.name?.trim()
    const validName =
      trimmedName && DISPLAY_NAME_PATTERN.test(trimmedName) ? trimmedName : undefined

    try {
      const updatedProfile = await onboardingMutation.mutateAsync({
        ...(validName && { displayName: validName }),
        caregiverRelationship: params.relationship,
        diagnosisStage: params.diagnosisStage,
        challenges: selected,
      })
      setUser(user, updatedProfile)
      router.replace('/(tabs)/')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Onboarding failed'
      Alert.alert('Error', message)
    }
  }

  return (
    <ScreenContainer
      footer={
        <Button
          label="Finish"
          onPress={handleFinish}
          loading={onboardingMutation.isPending}
          disabled={selected.length === 0}
        />
      }
    >
      <Heading size="$8" marginBottom="$2">
        Primary challenges
      </Heading>
      <SizableText size="$5" color="$color6" marginBottom="$5">
        Select all that apply. We&apos;ll focus on what matters most.
      </SizableText>

      <XStack flexWrap="wrap" gap="$2">
        {CHALLENGES.map((challenge) => (
          <Chip
            key={challenge}
            label={CHALLENGE_LABELS[challenge]}
            selected={selected.includes(challenge)}
            onPress={() => toggleChallenge(challenge)}
          />
        ))}
      </XStack>
    </ScreenContainer>
  )
}
