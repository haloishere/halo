import { useState } from 'react'
import { YStack, Heading, SizableText } from 'tamagui'
import { router, useLocalSearchParams } from 'expo-router'
import { CAREGIVER_RELATIONSHIPS } from '@halo/shared'
import type { CaregiverRelationship } from '@halo/shared'
import { Button, SelectionCard, ScreenContainer } from '../../src/components/ui'

const RELATIONSHIP_LABELS: Record<CaregiverRelationship, string> = {
  spouse: 'Spouse / Partner',
  child: 'Adult Child',
  sibling: 'Sibling',
  professional: 'Professional Caregiver',
  other: 'Other',
}

export default function RelationshipScreen() {
  const params = useLocalSearchParams<{ name?: string }>()
  const [selected, setSelected] = useState<CaregiverRelationship | null>(null)

  function handleContinue() {
    if (!selected) return
    router.push({
      pathname: '/(onboarding)/diagnosis',
      params: { name: params.name, relationship: selected },
    })
  }

  return (
    <ScreenContainer
      footer={<Button label="Continue" onPress={handleContinue} disabled={!selected} />}
    >
      <Heading size="$8" marginBottom="$2">
        Your caregiving role
      </Heading>
      <SizableText size="$5" color="$color6" marginBottom="$5">
        What is your relationship to the person you are caring for?
      </SizableText>

      <YStack gap="$2">
        {CAREGIVER_RELATIONSHIPS.map((rel) => (
          <SelectionCard
            key={rel}
            title={RELATIONSHIP_LABELS[rel]}
            selected={selected === rel}
            onPress={() => setSelected(rel)}
          />
        ))}
      </YStack>
    </ScreenContainer>
  )
}
