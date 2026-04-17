import { FlatList } from 'react-native'
import { H2, Paragraph, Separator, XStack, YStack } from 'tamagui'
import { Eye, Pencil, History } from '@tamagui/lucide-icons'
import { AnimatedScreen, EmptyState } from '../../src/components/ui'

type AuditRow = {
  id: string
  kind: 'read' | 'write'
  purpose: string
  fields: string[]
  caller: string
  when: string
}

// TODO: replace with `useAuditLogQuery()` once the API module lands.
const MOCK_AUDIT: AuditRow[] = [
  {
    id: 'a1',
    kind: 'read',
    purpose: 'Find a dinner spot in Luzern',
    fields: ['diet', 'favourite_cuisine', 'budget_dinner'],
    caller: 'Halo agent',
    when: '2 min ago',
  },
  {
    id: 'a2',
    kind: 'write',
    purpose: 'Save proposed entry: "prefers quiet venues on weekdays"',
    fields: ['vault_entries'],
    caller: 'Halo agent (you confirmed)',
    when: '10 min ago',
  },
  {
    id: 'a3',
    kind: 'read',
    purpose: 'Sync calendar availability',
    fields: ['connectors.google_calendar'],
    caller: 'Google connector',
    when: '1 hour ago',
  },
]

export default function AuditScreen() {
  return (
    <AnimatedScreen>
      <YStack flex={1} backgroundColor="$background" paddingHorizontal="$5" paddingTop="$4">
        <YStack gap="$2" marginBottom="$4">
          <H2 size="$8">Access log</H2>
          <Paragraph size="$3" color="$color10">
            Every read and write of your vault. Append-only, 12-month retention.
          </Paragraph>
        </YStack>

        <FlatList
          data={MOCK_AUDIT}
          keyExtractor={(it) => it.id}
          ItemSeparatorComponent={() => <Separator marginVertical="$3" />}
          ListEmptyComponent={
            <EmptyState icon={History as never} title="Nothing yet" description="Activity will show up here." />
          }
          renderItem={({ item }) => (
            <YStack gap="$1.5" paddingVertical="$2">
              <XStack alignItems="center" gap="$2">
                {item.kind === 'read' ? (
                  <Eye size={14} color="$color9" />
                ) : (
                  <Pencil size={14} color="$color9" />
                )}
                <Paragraph size="$2" color="$color9" fontWeight="600" textTransform="uppercase" letterSpacing={0.5}>
                  {item.kind === 'read' ? 'Read' : 'Write'}
                </Paragraph>
                <Paragraph size="$2" color="$color9" marginLeft="auto">{item.when}</Paragraph>
              </XStack>
              <Paragraph size="$4" color="$color12">{item.purpose}</Paragraph>
              <Paragraph size="$2" color="$color10">
                {item.caller} · {item.fields.join(', ')}
              </Paragraph>
            </YStack>
          )}
        />
      </YStack>
    </AnimatedScreen>
  )
}
