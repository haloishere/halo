import { useEffect, useRef, useState } from 'react'
import { Input, XStack, YStack } from 'tamagui'
import { Search } from '@tamagui/lucide-icons'
import { useToastController } from '@tamagui/toast'
import { AnimatedScreen, DailyTipCard, getTodaysTip } from '../../src/components/ui'
import { useDailyTipQuery } from '../../src/api/tips'

export default function HomeScreen() {
  const [search, setSearch] = useState('')
  const { data: dailyTip, refetch, isRefetching, isError } = useDailyTipQuery()
  const toastCtrl = useToastController()
  const shownRef = useRef(false)
  const cooldownTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [cooldown, setCooldown] = useState(false)
  const fallback = getTodaysTip()
  const tip = dailyTip?.tip ?? fallback.tip
  const category = dailyTip?.category ?? fallback.category

  useEffect(() => {
    if (isError && !shownRef.current) {
      shownRef.current = true
      toastCtrl.show('Could not load today\u2019s tip', {
        message: 'Showing a saved tip instead. Try again in 30 seconds.',
      })
      setCooldown(true)
      clearTimeout(cooldownTimer.current)
      cooldownTimer.current = setTimeout(() => setCooldown(false), 30_000)
    }
    if (!isError || isRefetching) {
      shownRef.current = false
    }
    return () => clearTimeout(cooldownTimer.current)
  }, [isError, isRefetching, toastCtrl])

  return (
    <AnimatedScreen>
      <YStack flex={1} backgroundColor="$background" padding="$6" paddingTop="$4">
        <XStack
          alignItems="center"
          backgroundColor="$color2"
          borderRadius="$6"
          borderWidth={1}
          borderColor="$color4"
          paddingHorizontal="$3.5"
          height={48}
          marginBottom="$4"
        >
          <Search size={18} color="$color8" />
          <Input
            flex={1}
            unstyled
            placeholder="Search tips, guides..."
            value={search}
            onChangeText={setSearch}
            size="$4"
            color="$color"
            placeholderTextColor="$color6"
            paddingHorizontal="$2.5"
            accessibilityLabel="Search"
          />
        </XStack>
        <DailyTipCard
          tip={tip}
          category={category}
          onRefresh={() => refetch()}
          isRefreshing={isRefetching}
          refreshDisabled={cooldown}
        />
      </YStack>
    </AnimatedScreen>
  )
}
