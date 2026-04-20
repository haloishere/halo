import { Heading, Paragraph, YStack } from 'tamagui'
import { router, useLocalSearchParams } from 'expo-router'
import { ShieldCheck, Key, History, Trash2 } from '@tamagui/lucide-icons'
import { useToastController } from '@tamagui/toast'
import { Button, ScreenContainer } from '../../src/components/ui'
import { useOnboardingMutation } from '../../src/api/users'
import { useAuthStore } from '../../src/stores/auth'

const GUARANTEES = [
  {
    icon: ShieldCheck,
    title: 'Only the agent reads your vault',
    body: 'External services see the minimum context required for your request — never your raw data.',
  },
  {
    icon: History,
    title: 'Full access log',
    body: 'Every read and write is recorded. You can inspect it at any time.',
  },
  {
    icon: Key,
    title: 'You control consent',
    body: 'Any connector, service, or scope can be revoked in one tap.',
  },
  {
    icon: Trash2,
    title: 'Export or delete anything',
    body: 'Full JSON export. One tap to wipe everything, permanently.',
  },
]

export default function ConsentScreen() {
  const params = useLocalSearchParams<{ name?: string; city?: string }>()
  const mutation = useOnboardingMutation()
  const toast = useToastController()
  const firebaseUser = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)

  async function handleFinish() {
    // Guard: the Firebase session could have expired during onboarding.
    // Without a user, `setUser(null, profile)` would strand the tabs on an
    // unauthenticated state and the next API call would 401.
    if (!firebaseUser) {
      toast.show('Session expired', { message: 'Please sign in again.' })
      router.replace('/(auth)/enter-email')
      return
    }
    try {
      const profile = await mutation.mutateAsync({
        displayName: params.name,
        city: params.city,
      })
      setUser(firebaseUser, profile)
      router.replace('/(tabs)')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Please try again.'
      toast.show('Setup failed', { message })
    }
  }

  return (
    <ScreenContainer
      scrollable
      footer={
        <Button
          label="I understand — let's go"
          accessibilityLabel="Finish onboarding"
          onPress={handleFinish}
          loading={mutation.isPending}
        />
      }
    >
      <Heading size="$8" marginBottom="$2">
        How Halo keeps your vault safe
      </Heading>
      {/* "Four" mirrors GUARANTEES.length — update together. */}
      <Paragraph size="$4" color="$color10" marginBottom="$6">
        Four promises. Non-negotiable.
      </Paragraph>

      <YStack gap="$5">
        {GUARANTEES.map(({ icon: Icon, title, body }) => (
          <YStack key={title} gap="$1.5">
            <YStack flexDirection="row" alignItems="center" gap="$2">
              <Icon size={18} color="$accent9" />
              <Paragraph size="$4" fontWeight="700">
                {title}
              </Paragraph>
            </YStack>
            <Paragraph size="$3" color="$color10">
              {body}
            </Paragraph>
          </YStack>
        ))}
      </YStack>

      <Paragraph size="$2" color="$color9" marginTop="$8">
        {params.name ? `${params.name}, ` : ''}you're in control. Always.
      </Paragraph>
    </ScreenContainer>
  )
}
