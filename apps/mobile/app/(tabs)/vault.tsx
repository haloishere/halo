import { FlatList } from 'react-native'
import { H2, Paragraph, Separator, XStack, YStack } from 'tamagui'
import { Tag, ShieldCheck } from '@tamagui/lucide-icons'
import { AnimatedScreen, Chip, EmptyState } from '../../src/components/ui'

type VaultEntry = {
  id: string
  label: string
  value: string
  source: 'agent' | 'connector' | 'manual'
  updatedAt: string
}

// TODO: replace with `useVaultEntriesQuery()` once the API module lands.
const MOCK_VAULT: VaultEntry[] = [
  { id: '1', label: 'Diet', value: 'Vegetarian, no mushrooms', source: 'agent', updatedAt: '2 days ago' },
  { id: '2', label: 'Favourite cuisine', value: 'Japanese, Middle-Eastern', source: 'agent', updatedAt: '1 week ago' },
  { id: '3', label: 'Usual neighbourhood in Luzern', value: 'Altstadt / Neustadt', source: 'manual', updatedAt: '3 weeks ago' },
  { id: '4', label: 'Budget for dinner', value: 'CHF 40–80 per person', source: 'agent', updatedAt: '1 week ago' },
  { id: '5', label: 'Calendar', value: 'Google (syncing)', source: 'connector', updatedAt: 'just now' },
]

const SOURCE_COPY: Record<VaultEntry['source'], string> = {
  agent: 'Proposed by agent',
  connector: 'From connector',
  manual: 'Added by you',
}

export default function VaultScreen() {
  return (
    <AnimatedScreen>
      <YStack flex={1} backgroundColor="$background" paddingHorizontal="$5" paddingTop="$4">
        <YStack gap="$2" marginBottom="$4">
          <H2 size="$8">Your vault</H2>
          <Paragraph size="$3" color="$color10">
            Only Halo's agent can read this. Every access is logged.
          </Paragraph>
        </YStack>

        <FlatList
          data={MOCK_VAULT}
          keyExtractor={(it) => it.id}
          ItemSeparatorComponent={() => <Separator marginVertical="$3" />}
          ListEmptyComponent={
            <EmptyState
              icon={ShieldCheck as never}
              title="Your vault is empty"
              description="Start a conversation. The agent will propose entries to save."
            />
          }
          renderItem={({ item }) => (
            <YStack gap="$1.5" paddingVertical="$2">
              <XStack alignItems="center" gap="$2">
                <Tag size={14} color="$color9" />
                <Paragraph size="$2" color="$color9" fontWeight="600" textTransform="uppercase" letterSpacing={0.5}>
                  {item.label}
                </Paragraph>
              </XStack>
              <Paragraph size="$5" color="$color12">{item.value}</Paragraph>
              <XStack gap="$2" marginTop="$1">
                <Chip size="$2">{SOURCE_COPY[item.source]}</Chip>
                <Paragraph size="$2" color="$color9">{item.updatedAt}</Paragraph>
              </XStack>
            </YStack>
          )}
        />
      </YStack>
    </AnimatedScreen>
  )
}
