import { Paragraph, XStack, YStack, SizableText } from 'tamagui'
import { TextInput } from 'react-native'
import type { Question, QuestionAnswer } from '@halo/shared'
import { Button } from '../ui'

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
          <SizableText size="$2" color="$color10" marginBottom="$1">
            Anything else?
          </SizableText>
          <TextInput
            value={answer.freeText ?? ''}
            onChangeText={handleFreeText}
            placeholder="Add details..."
            accessibilityLabel="Additional details"
            multiline
            style={{
              borderWidth: 1,
              borderColor: '#ccc',
              borderRadius: 8,
              padding: 10,
              minHeight: 60,
              fontSize: 15,
            }}
          />
        </YStack>
      )}
    </YStack>
  )
}
