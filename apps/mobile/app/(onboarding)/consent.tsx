import { Heading, Paragraph, YStack } from 'tamagui'
import { router, useLocalSearchParams } from 'expo-router'
import { ShieldCheck, Key, History, Trash2 } from '@tamagui/lucide-icons'
import { Button, ScreenContainer } from '../../src/components/ui'

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

  function handleFinish() {
    // TODO: POST the onboarding payload { name, city } to /v1/users/onboarding
    // once the vault API is live. For now, land on the tabs.
    router.replace('/(tabs)')
  }

  return (
    <ScreenContainer
      scrollable
      footer={<Button label="I understand — let\u2019s go" onPress={handleFinish} />}
    >
      <Heading size="$8" marginBottom="$2">
        How Halo keeps your vault safe
      </Heading>
      <Paragraph size="$4" color="$color10" marginBottom="$6">
        Before we start building your vault, here\u2019s what you\u2019re agreeing to.
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
        {params.name ? `${params.name}, ` : ''}you\u2019re in control. Always.
      </Paragraph>
    </ScreenContainer>
  )
}
