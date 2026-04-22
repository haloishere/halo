import { useState } from 'react'
import { XStack, YStack, SizableText, Spinner } from 'tamagui'
import { Check, X } from '@tamagui/lucide-icons'
import type { MemoryProposal, VaultTopic } from '@halo/shared'
import { useCreateVaultEntryMutation } from '../../api/vault'
import { Button } from '../ui'

export interface ProposalStripProps {
  proposal: MemoryProposal
  onDismiss: () => void
}

// Derive a sensible vault category from the conversation topic.
// All three map to existing PREFERENCE_CATEGORIES — no unknown values.
function categoryForTopic(topic: VaultTopic) {
  if (topic === 'food_and_restaurants') return 'food' as const
  return 'lifestyle' as const
}

export function ProposalStrip({ proposal, onDismiss }: ProposalStripProps) {
  const createEntry = useCreateVaultEntryMutation()
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await createEntry.mutateAsync({
        type: 'preference',
        topic: proposal.topic,
        content: {
          category: categoryForTopic(proposal.topic),
          subject: proposal.label,
          sentiment: 'likes',
          confidence: 0.8,
          notes: proposal.value,
        },
      })
    } catch {
      // Save failure is non-fatal — dismiss anyway so the strip doesn't
      // block the conversation. The vault can be filled via questionnaire.
    } finally {
      setSaving(false)
      onDismiss()
    }
  }

  function handleReject() {
    onDismiss()
  }

  return (
    <YStack
      backgroundColor="$accent3"
      borderRadius="$3"
      marginHorizontal="$3"
      marginVertical="$2"
      padding="$3"
      gap="$2"
    >
      <SizableText size="$2" color="$accent11" fontWeight="600">
        Remember this?
      </SizableText>

      <SizableText size="$3" color="$color" numberOfLines={3}>
        {proposal.value}
      </SizableText>

      <XStack gap="$2" justifyContent="flex-end">
        <Button
          variant="secondary"
          label="Skip"
          accessibilityLabel="Reject memory"
          onPress={handleReject}
          disabled={saving}
          icon={<X size={14} />}
        />
        <Button
          variant="primary"
          label={saving ? '' : 'Save'}
          accessibilityLabel="Save memory"
          onPress={handleSave}
          disabled={saving}
          icon={saving ? <Spinner size="small" /> : <Check size={14} />}
        />
      </XStack>
    </YStack>
  )
}
