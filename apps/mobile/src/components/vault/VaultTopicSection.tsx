import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { View, useColorScheme } from 'react-native'
import { Progress, Separator, SizableText, Theme, XStack, YStack } from 'tamagui'
import type { VaultEntryListItem, VaultTopic } from '@halo/shared'
import { VaultEntryCard } from './VaultEntryCard'

// Tracks the 5 curated questionnaire questions per topic — full bar = the user
// has answered every core preference.
const TARGET_MEMORIES = 5

// Accent palette steps pulled from themes.ts to use inside SVG and native
// elements that can't reference Tamagui tokens directly.
const ACCENT: Record<'light' | 'dark', { mid: string; strong: string; subtle: string }> = {
  light: {
    mid: 'hsla(219, 72%, 45%, 1)', // accent7
    strong: 'hsla(219, 95%, 26%, 1)', // accent9 — Presidential Blue
    subtle: 'hsla(219, 55%, 81%, 1)', // accent4
  },
  dark: {
    mid: 'hsla(220, 68%, 47%, 1)',
    strong: 'hsla(220, 80%, 64%, 1)',
    subtle: 'hsla(221, 50%, 22%, 1)',
  },
}

// L-shaped bracket drawn at a card corner using only borders.
function CornerBracket({ corner, color }: { corner: 'topLeft' | 'bottomRight'; color: string }) {
  const tl = corner === 'topLeft'
  return (
    <View
      style={{
        position: 'absolute',
        top: tl ? 0 : undefined,
        left: tl ? 0 : undefined,
        bottom: tl ? undefined : 0,
        right: tl ? undefined : 0,
        width: 18,
        height: 18,
        borderTopWidth: tl ? 1.5 : 0,
        borderLeftWidth: tl ? 1.5 : 0,
        borderBottomWidth: tl ? 0 : 1.5,
        borderRightWidth: tl ? 0 : 1.5,
        borderTopLeftRadius: tl ? 5 : 0,
        borderBottomRightRadius: tl ? 0 : 5,
        borderColor: color,
      }}
    />
  )
}

export interface VaultTopicSectionProps {
  title: string
  entries: VaultEntryListItem[]
  onDelete: (payload: { id: string; topic: VaultTopic }) => void
  emptyHint?: string
  quickFillCTA?: ReactNode
  /** Topic icon rendered inside the accent badge in the card header. */
  icon?: ReactNode
}

export function VaultTopicSection({
  title,
  entries,
  onDelete,
  emptyHint,
  quickFillCTA,
  icon,
}: VaultTopicSectionProps) {
  const scheme = useColorScheme() ?? 'light'
  const accent = ACCENT[scheme]

  const count = entries.length
  const progressPct = Math.min((count / TARGET_MEMORIES) * 100, 100)

  // Animate progress bar fill from 0 on mount — gives the "filling up"
  // effect after the card entrance animation completes.
  const [displayPct, setDisplayPct] = useState(0)
  useEffect(() => {
    const id = setTimeout(() => setDisplayPct(progressPct), 650)
    return () => clearTimeout(id)
  }, [progressPct])

  const isFull = count >= TARGET_MEMORIES

  return (
    <YStack
      position="relative"
      borderRadius="$4"
      borderWidth={1}
      borderColor="$color5"
      backgroundColor="$color1"
      padding="$4"
      paddingTop="$5"
      gap="$3"
    >
      {/* Dossier corner brackets */}
      <CornerBracket corner="topLeft" color={accent.mid} />
      <CornerBracket corner="bottomRight" color={accent.mid} />

      {/* Card header: icon badge + title + count pill */}
      <XStack alignItems="center" gap="$3">
        {icon && (
          <Theme name="accent">
            <XStack
              width={40}
              height={40}
              borderRadius={20}
              backgroundColor="$color3"
              alignItems="center"
              justifyContent="center"
              borderWidth={1}
              borderColor="$color5"
            >
              {icon}
            </XStack>
          </Theme>
        )}

        <YStack flex={1} gap="$0.5">
          <SizableText size="$5" fontWeight="700" color="$color12">
            {title}
          </SizableText>
        </YStack>

        {/* n/5 pill */}
        <Theme name="accent">
          <XStack
            paddingHorizontal="$2.5"
            paddingVertical="$1"
            borderRadius={999}
            backgroundColor={isFull ? '$color8' : '$color3'}
            borderWidth={1}
            borderColor={isFull ? '$color8' : '$color5'}
          >
            <SizableText size="$1" fontWeight="600" color={isFull ? '$color1' : '$color10'}>
              {Math.min(count, TARGET_MEMORIES)} / {TARGET_MEMORIES}
            </SizableText>
          </XStack>
        </Theme>
      </XStack>

      {/* Animated progress fill */}
      <YStack gap="$1">
        <Progress value={displayPct} size="$1" backgroundColor="$color4">
          <Theme name="accent">
            <Progress.Indicator backgroundColor="$color9" transition="bouncy" />
          </Theme>
        </Progress>
        {isFull && (
          <SizableText size="$1" color="$accent9" fontWeight="600" letterSpacing={0.8}>
            PROFILE COMPLETE
          </SizableText>
        )}
      </YStack>

      {/* Entries or empty state */}
      {count === 0 ? (
        <YStack gap="$2" paddingTop="$1">
          {emptyHint && (
            <SizableText size="$3" color="$color9" fontStyle="italic">
              {emptyHint}
            </SizableText>
          )}
          {quickFillCTA}
        </YStack>
      ) : (
        <YStack gap="$2">
          {entries.map((entry, idx) => (
            <YStack key={entry.id} gap="$2">
              {idx > 0 && <Separator borderColor="$color3" />}
              <VaultEntryCard entry={entry} onDelete={onDelete} />
            </YStack>
          ))}
        </YStack>
      )}
    </YStack>
  )
}
