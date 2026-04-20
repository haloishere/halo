import { useState } from 'react'
import { Heading, SizableText } from 'tamagui'
import { router, useLocalSearchParams } from 'expo-router'
import { DISPLAY_NAME_PATTERN, DISPLAY_NAME_MAX_LENGTH, DISPLAY_NAME_ERROR } from '@halo/shared'
import { Button, Input, ScreenContainer } from '../../src/components/ui'
import { useAuthStore } from '../../src/stores/auth'

export default function WelcomeScreen() {
  const params = useLocalSearchParams<{ name?: string }>()
  // OAuth (Google/Apple) users arrive with a Firebase displayName already set.
  // First-word prefill matches the "first name" affordance of the input.
  const firebaseFirstName = useAuthStore((s) => (s.user?.displayName ?? '').split(' ')[0] ?? '')
  const [name, setName] = useState(params.name ?? firebaseFirstName)

  const trimmed = name.trim()
  const isValid = trimmed.length > 0 && DISPLAY_NAME_PATTERN.test(trimmed)
  const showError = trimmed.length > 0 && !isValid

  function handleContinue() {
    if (!isValid) return
    router.push({ pathname: '/(onboarding)/city', params: { name: trimmed } })
  }

  return (
    <ScreenContainer
      scrollable={false}
      footer={<Button label="Continue" onPress={handleContinue} disabled={!isValid} />}
    >
      <Heading size="$8" marginBottom="$2">
        What&apos;s your name?
      </Heading>
      <SizableText size="$5" color="$color10" marginBottom="$6">
        We&apos;ll use this to personalize your experience.
      </SizableText>

      <Input
        placeholder="Your first name"
        value={name}
        onChangeText={setName}
        maxLength={DISPLAY_NAME_MAX_LENGTH}
        autoCapitalize="words"
        autoFocus
        returnKeyType="done"
        onSubmitEditing={handleContinue}
        accessibilityLabel="Your name"
      />
      {showError && (
        <SizableText size="$3" color="$red10" marginTop="$2">
          {DISPLAY_NAME_ERROR}
        </SizableText>
      )}
    </ScreenContainer>
  )
}
