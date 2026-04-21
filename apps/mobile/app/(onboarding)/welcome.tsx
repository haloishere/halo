import { useRef, useState } from 'react'
import type { TextInput } from 'react-native'
import { Heading, SizableText, YStack } from 'tamagui'
import { router, useLocalSearchParams } from 'expo-router'
import {
  AGE_MAX,
  AGE_MIN,
  DISPLAY_NAME_ERROR,
  DISPLAY_NAME_MAX_LENGTH,
  DISPLAY_NAME_PATTERN,
} from '@halo/shared'
import { Button, Input, ScreenContainer } from '../../src/components/ui'
import { useAuthStore } from '../../src/stores/auth'

export default function WelcomeScreen() {
  const params = useLocalSearchParams<{ name?: string; age?: string }>()
  // OTP users and Apple-declined users arrive with displayName === null.
  const firebaseFirstName = useAuthStore((s) => (s.user?.displayName ?? '').split(' ')[0])
  const [name, setName] = useState(params.name ?? firebaseFirstName)
  const [ageInput, setAgeInput] = useState(params.age ?? '')
  const ageRef = useRef<TextInput | null>(null)

  const trimmedName = name.trim()
  const nameValid = trimmedName.length > 0 && DISPLAY_NAME_PATTERN.test(trimmedName)
  const nameError = trimmedName.length > 0 && !nameValid

  // Require digits-only so `parseInt` can't silently accept "18abc" as 18.
  const ageDigitsOnly = /^\d+$/.test(ageInput)
  const parsedAge = ageDigitsOnly ? Number.parseInt(ageInput, 10) : NaN
  const ageValid = Number.isInteger(parsedAge) && parsedAge >= AGE_MIN && parsedAge <= AGE_MAX
  const ageError = ageInput.length > 0 && !ageValid

  const canContinue = nameValid && ageValid

  function handleContinue() {
    if (!canContinue) return
    router.push({
      pathname: '/(onboarding)/city',
      params: { name: trimmedName, age: String(parsedAge) },
    })
  }

  return (
    <ScreenContainer
      scrollable={false}
      footer={<Button label="Continue" onPress={handleContinue} disabled={!canContinue} />}
    >
      <Heading size="$8" marginBottom="$2">
        About you
      </Heading>
      <SizableText size="$5" color="$color10" marginBottom="$6">
        We&apos;ll use this to personalize your experience.
      </SizableText>

      <YStack gap="$4">
        <Input
          label="First name"
          placeholder="Your first name"
          value={name}
          onChangeText={setName}
          maxLength={DISPLAY_NAME_MAX_LENGTH}
          autoCapitalize="words"
          autoFocus
          returnKeyType="next"
          onSubmitEditing={() => ageRef.current?.focus()}
          accessibilityLabel="Your name"
          error={nameError ? DISPLAY_NAME_ERROR : undefined}
        />

        <Input
          ref={ageRef}
          label="Age"
          placeholder="e.g. 32"
          value={ageInput}
          onChangeText={setAgeInput}
          keyboardType="number-pad"
          maxLength={3}
          returnKeyType="done"
          onSubmitEditing={handleContinue}
          accessibilityLabel="Your age"
          error={ageError ? `Must be between ${AGE_MIN} and ${AGE_MAX}` : undefined}
        />
      </YStack>
    </ScreenContainer>
  )
}
