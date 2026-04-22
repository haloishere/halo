import { Paragraph, XStack, YStack } from 'tamagui'
import type { Question, QuestionAnswer } from '@halo/shared'
import { Button, Input } from '../ui'

interface QuestionCardProps {
  question: Question
  answer: QuestionAnswer
  onChange: (answer: QuestionAnswer) => void
}

export function QuestionCard({ question, answer, onChange }: QuestionCardProps) {
  function toggleChip(chip: string) {
    const selected = answer.chips.includes(chip)
    const chips = selected ? answer.chips.filter((c) => c !== chip) : [...answer.chips, chip]
    onChange({ ...answer, chips })
  }

  function handleFreeText(text: string) {
    onChange({ ...answer, freeText: text })
  }

  return (
    <YStack gap="$3">
      <Paragraph size="$5" fontWeight="600">
        {question.prompt}
      </Paragraph>

      <XStack flexWrap="wrap" gap="$2">
        {question.chips.map((chip) => {
          const isSelected = answer.chips.includes(chip)
          return (
            <Button
              key={chip}
              label={chip}
              variant={isSelected ? 'primary' : 'outline'}
              onPress={() => toggleChip(chip)}
            />
          )
        })}
      </XStack>

      {question.allowFreeText && (
        <YStack>
          <Paragraph size="$2" color="$color10" marginBottom="$1">
            Anything else?
          </Paragraph>
          <Input
            value={answer.freeText ?? ''}
            onChangeText={handleFreeText}
            placeholder="Add details..."
            accessibilityLabel="Additional details"
            multiline
            numberOfLines={3}
          />
        </YStack>
      )}
    </YStack>
  )
}
