import { Card, H4, Paragraph, Progress, Separator, SizableText, XStack, YStack } from 'tamagui'
import { GraduationCap, Target, TrendingUp, Award } from '@tamagui/lucide-icons'

function MilestonePreview({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof GraduationCap
  title: string
  description: string
}) {
  return (
    <XStack gap="$3" alignItems="center" opacity={0.6}>
      <YStack
        width={40}
        height={40}
        borderRadius="$10"
        backgroundColor="$accent3"
        alignItems="center"
        justifyContent="center"
      >
        <Icon size={20} color="$accent9" />
      </YStack>
      <YStack flex={1} gap="$1">
        <SizableText size="$4" fontWeight="600" color="$color">
          {title}
        </SizableText>
        <SizableText size="$2" color="$color8">
          {description}
        </SizableText>
      </YStack>
    </XStack>
  )
}

export function LearningPathTab() {
  return (
    <YStack flex={1} padding="$6" paddingTop="$4" gap="$5">
      {/* Hero section */}
      <Card size="$4" elevation="$2" backgroundColor="$accent3">
        <Card.Header>
          <XStack gap="$3" alignItems="center">
            <YStack
              width={48}
              height={48}
              borderRadius="$10"
              backgroundColor="$accent5"
              alignItems="center"
              justifyContent="center"
            >
              <GraduationCap size={24} color="$accent11" />
            </YStack>
            <YStack flex={1}>
              <H4 color="$accent11">Learning Path</H4>
              <SizableText size="$3" color="$accent9">
                Coming Soon
              </SizableText>
            </YStack>
          </XStack>
        </Card.Header>
        <Paragraph
          size="$4"
          color="$accent11"
          paddingHorizontal="$4"
          paddingBottom="$4"
          opacity={0.8}
        >
          Personalized learning journeys tailored to your caregiving stage.
          Track your progress and earn milestones as you grow.
        </Paragraph>
      </Card>

      {/* Preview milestones */}
      <YStack gap="$4">
        <SizableText size="$3" color="$color8" fontWeight="600" textTransform="uppercase">
          What to expect
        </SizableText>

        <MilestonePreview
          icon={Target}
          title="Personalized Paths"
          description="Content matched to your care situation"
        />

        <Separator />

        <MilestonePreview
          icon={TrendingUp}
          title="Progress Tracking"
          description="See how far you've come at a glance"
        />

        <Separator />

        <MilestonePreview
          icon={Award}
          title="Milestones & Goals"
          description="Celebrate your learning achievements"
        />
      </YStack>

      {/* Decorative progress preview */}
      <Card size="$3" backgroundColor="$color2" opacity={0.5}>
        <Card.Header>
          <SizableText size="$3" color="$color8" fontWeight="500">
            Your Progress
          </SizableText>
        </Card.Header>
        <YStack paddingHorizontal="$3" paddingBottom="$3" gap="$2">
          <Progress value={0} size="$1" backgroundColor="$color4">
            <Progress.Indicator backgroundColor="$accent9" />
          </Progress>
          <SizableText size="$2" color="$color6">
            Start your journey soon
          </SizableText>
        </YStack>
      </Card>
    </YStack>
  )
}
