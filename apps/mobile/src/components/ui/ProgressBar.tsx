import { YStack, Progress, SizableText } from 'tamagui'

export interface ProgressBarProps {
  currentStep: number
  totalSteps: number
}

export function ProgressBar({ currentStep, totalSteps }: ProgressBarProps) {
  const percentage = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0

  return (
    <YStack
      backgroundColor="$background"
      paddingTop="$3"
      paddingHorizontal="$6"
      paddingBottom="$3"
      gap="$1.5"
    >
      <Progress value={percentage} size="$1" backgroundColor="$color4">
        <Progress.Indicator backgroundColor="$accent9" transition="bouncy" />
      </Progress>
      <SizableText size="$3" color="$color6">
        Step {currentStep} of {totalSteps}
      </SizableText>
    </YStack>
  )
}
