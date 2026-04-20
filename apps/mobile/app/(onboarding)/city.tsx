import { useState } from 'react'
import { Heading, SizableText, YStack } from 'tamagui'
import { router, useLocalSearchParams } from 'expo-router'
import { Button, ScreenContainer, SelectionCard } from '../../src/components/ui'

const CITIES = [
  { id: 'luzern', label: 'Luzern', note: 'Full support — V1 city' },
  { id: 'zurich', label: 'Zürich', note: 'Coming soon' },
  { id: 'basel', label: 'Basel', note: 'Coming soon' },
  { id: 'other', label: 'Somewhere else', note: 'Tell us in the app — we\u2019ll prioritise' },
] as const

type CityId = (typeof CITIES)[number]['id']

export default function CityScreen() {
  const params = useLocalSearchParams<{ name?: string }>()
  const [city, setCity] = useState<CityId | null>('luzern')

  function handleContinue() {
    if (!city) return
    router.push({
      pathname: '/(onboarding)/consent',
      params: { name: params.name ?? '', city },
    })
  }

  return (
    <ScreenContainer
      scrollable={false}
      footer={<Button label="Continue" onPress={handleContinue} disabled={!city} />}
    >
      <Heading size="$8" marginBottom="$2">
        Where do you live?
      </Heading>
      <SizableText size="$5" color="$color10" marginBottom="$6">
        Halo knows Luzern best. More cities soon.
      </SizableText>

      <YStack gap="$3">
        {CITIES.map((c) => (
          <SelectionCard
            key={c.id}
            title={c.label}
            description={c.note}
            selected={city === c.id}
            onPress={() => setCity(c.id)}
          />
        ))}
      </YStack>
    </ScreenContainer>
  )
}
