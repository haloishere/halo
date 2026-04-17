import { XStack, YStack, SizableText, Button, Spinner } from 'tamagui'
import { Lightbulb, RefreshCw } from '@tamagui/lucide-icons'

export interface DailyTipCardProps {
  tip: string
  category?: string
  onRefresh?: () => void
  isRefreshing?: boolean
  refreshDisabled?: boolean
}

export const DAILY_TIPS: ReadonlyArray<{ tip: string; category: string }> = [
  {
    tip: 'Take 10 minutes today just for yourself. Even a short walk can help recharge your energy.',
    category: 'Self Care',
  },
  {
    tip: 'Try using simple, short sentences when communicating. Patience and a calm tone go a long way.',
    category: 'Communication',
  },
  {
    tip: 'Keep a consistent daily routine — it helps reduce confusion and provides comfort.',
    category: 'Daily Care',
  },
  {
    tip: 'Label cabinets and drawers with pictures or words to help with everyday tasks.',
    category: 'Safety',
  },
  {
    tip: "It's okay to feel frustrated. Acknowledging your emotions is the first step to managing them.",
    category: 'Emotional',
  },
  {
    tip: 'Play familiar music during meals or activities — it can boost mood and spark memories.',
    category: 'Communication',
  },
  {
    tip: 'Reach out to a support group this week. Connecting with others who understand can make a real difference.',
    category: 'Self Care',
  },
]

export function getTodaysTip(): { tip: string; category: string } {
  const dayIndex = new Date().getDay()
  return DAILY_TIPS[dayIndex]!
}

export function DailyTipCard({
  tip,
  category,
  onRefresh,
  isRefreshing,
  refreshDisabled,
}: DailyTipCardProps) {
  return (
    <YStack
      backgroundColor="$color2"
      borderRadius="$4"
      padding="$4"
      borderWidth={1}
      borderColor="$color4"
      accessible
      accessibilityRole="text"
    >
      <XStack alignItems="center" gap="$2">
        <Lightbulb size={18} color="$accent9" />
        <SizableText size="$4" color="$color8" fontWeight="600">
          Daily Tip
        </SizableText>
        {category && (
          <SizableText testID="daily-tip-category" size="$2" color="$accent9" marginLeft="auto">
            {category}
          </SizableText>
        )}
        {onRefresh && (
          <Button
            testID="daily-tip-refresh"
            size="$2"
            circular
            chromeless
            marginLeft={category ? undefined : 'auto'}
            onPress={onRefresh}
            disabled={isRefreshing || refreshDisabled}
            opacity={isRefreshing || refreshDisabled ? 0.4 : 1}
            icon={isRefreshing ? <Spinner size="small" /> : <RefreshCw size={14} color="$color8" />}
            accessibilityLabel="Get new tip"
          />
        )}
      </XStack>
      <SizableText size="$4" color="$color" marginTop="$2">
        {tip}
      </SizableText>
    </YStack>
  )
}
