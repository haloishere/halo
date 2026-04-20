import { useState } from 'react'
import { Heading, SizableText } from 'tamagui'
import { router, useLocalSearchParams } from 'expo-router'
import { Button, CityCombobox, ScreenContainer } from '../../src/components/ui'

export default function CityScreen() {
  const params = useLocalSearchParams<{ name?: string; age?: string }>()
  const [city, setCity] = useState('')

  const trimmed = city.trim()
  const canContinue = trimmed.length > 0

  function handleContinue() {
    if (!canContinue) return
    router.push({
      pathname: '/(onboarding)/consent',
      params: { name: params.name ?? '', age: params.age ?? '', city: trimmed },
    })
  }

  return (
    <ScreenContainer
      scrollable={false}
      footer={<Button label="Continue" onPress={handleContinue} disabled={!canContinue} />}
    >
      <Heading size="$8" marginBottom="$2">
        Where do you live?
      </Heading>
      <SizableText size="$5" color="$color10" marginBottom="$6">
        Type any city in Switzerland, Germany, France, Belgium, or the Netherlands.
      </SizableText>

      <CityCombobox value={city} onChangeText={setCity} accessibilityLabel="City" />
    </ScreenContainer>
  )
}
