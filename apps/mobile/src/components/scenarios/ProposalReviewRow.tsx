import { XStack, YStack, Paragraph, SizableText } from 'tamagui'
import type { MemoryProposal } from '@halo/shared'
import { Button } from '../ui'

interface ProposalReviewRowProps {
  proposal: MemoryProposal
  selected: boolean
  onToggle: (selected: boolean) => void
}

export function ProposalReviewRow({ proposal, selected, onToggle }: ProposalReviewRowProps) {
  return (
    <XStack
      alignItems="center"
      gap="$3"
      paddingVertical="$2"
      accessibilityLabel={`${proposal.label} memory proposal`}
    >
      <YStack flex={1} gap="$0.5">
        <SizableText size="$3" fontWeight="600">
          {proposal.label}
        </SizableText>
        <Paragraph size="$2" color="$color10">
          {proposal.value}
        </Paragraph>
      </YStack>

      {selected ? (
        <Button
          label="Skip"
          variant="outline"
          accessibilityLabel={`Skip ${proposal.label}`}
          onPress={() => onToggle(false)}
        />
      ) : (
        <Button
          label="Save"
          variant="primary"
          accessibilityLabel={`Save ${proposal.label}`}
          onPress={() => onToggle(true)}
        />
      )}
    </XStack>
  )
}
