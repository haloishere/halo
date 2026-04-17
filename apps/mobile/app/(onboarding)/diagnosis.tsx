import { useState } from 'react'
import { YStack, Heading, SizableText } from 'tamagui'
import { router, useLocalSearchParams } from 'expo-router'
import { DIAGNOSIS_STAGES } from '@halo/shared'
import type { DiagnosisStage, CaregiverRelationship } from '@halo/shared'
import { Button, SelectionCard, ScreenContainer } from '../../src/components/ui'

const STAGE_INFO: Record<DiagnosisStage, { label: string; description: string }> = {
  early: {
    label: 'Early stage',
    description: 'Mild memory loss, slight personality changes. Person is largely independent.',
  },
  middle: {
    label: 'Middle stage',
    description:
      'Increasing memory loss, needs help with daily tasks. Most common caregiving stage.',
  },
  late: {
    label: 'Late stage',
    description: 'Severe loss of communication and mobility. Full-time care required.',
  },
  unknown: {
    label: 'Not sure',
    description: "You haven't received a formal diagnosis or aren't sure of the stage.",
  },
}

export default function DiagnosisScreen() {
  const params = useLocalSearchParams<{
    name?: string
    relationship?: CaregiverRelationship
  }>()
  const [selected, setSelected] = useState<DiagnosisStage | null>(null)

  function handleContinue() {
    if (!selected) return
    router.push({
      pathname: '/(onboarding)/challenges',
      params: { name: params.name, relationship: params.relationship, diagnosisStage: selected },
    })
  }

  return (
    <ScreenContainer
      footer={<Button label="Continue" onPress={handleContinue} disabled={!selected} />}
    >
      <Heading size="$8" marginBottom="$2">
        Diagnosis stage
      </Heading>
      <SizableText size="$5" color="$color6" marginBottom="$5">
        Understanding the stage helps us provide relevant guidance.
      </SizableText>

      <YStack gap="$2">
        {DIAGNOSIS_STAGES.map((stage) => {
          const info = STAGE_INFO[stage]
          return (
            <SelectionCard
              key={stage}
              title={info.label}
              description={info.description}
              selected={selected === stage}
              onPress={() => setSelected(stage)}
            />
          )
        })}
      </YStack>
    </ScreenContainer>
  )
}
