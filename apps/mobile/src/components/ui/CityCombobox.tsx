import { useEffect, useMemo, useRef, useState } from 'react'
import { Keyboard } from 'react-native'
import { SizableText, YStack } from 'tamagui'
import { Input } from './Input'
import citiesData from '../../constants/cities.json'

// Stored as `{ n, c }` in JSON to shrink bundle size; expanded here so every
// downstream reader sees readable keys.
type CityEntry = { name: string; country: string }

const CITIES: readonly CityEntry[] = (citiesData as { n: string; c: string }[]).map((e) => ({
  name: e.n,
  country: e.c,
}))
const MAX_SUGGESTIONS = 6
// Grace window so a suggestion row's onPress fires before blur hides the list.
export const BLUR_DELAY_MS = 150

export interface CityComboboxProps {
  value: string
  onChangeText: (value: string) => void
  placeholder?: string
  accessibilityLabel?: string
}

function filterCities(query: string): CityEntry[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const prefix: CityEntry[] = []
  for (const entry of CITIES) {
    if (entry.name.toLowerCase().startsWith(q)) {
      prefix.push(entry)
      if (prefix.length >= MAX_SUGGESTIONS) return prefix
    }
  }
  if (prefix.length > 0) return prefix
  // Fallback: substring match when no prefix hits.
  const substring: CityEntry[] = []
  for (const entry of CITIES) {
    if (entry.name.toLowerCase().includes(q)) {
      substring.push(entry)
      if (substring.length >= MAX_SUGGESTIONS) break
    }
  }
  return substring
}

export function CityCombobox({
  value,
  onChangeText,
  placeholder = 'Type your city',
  accessibilityLabel = 'City',
}: CityComboboxProps) {
  const [focused, setFocused] = useState(false)
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const suggestions = useMemo(() => filterCities(value), [value])
  const listVisible = focused && suggestions.length > 0 && value.trim().length > 0

  // Clear any pending blur timer on unmount — otherwise a late setState lands
  // on an unmounted component.
  useEffect(() => {
    return () => {
      if (blurTimer.current) clearTimeout(blurTimer.current)
    }
  }, [])

  function handleFocus() {
    if (blurTimer.current) {
      clearTimeout(blurTimer.current)
      blurTimer.current = null
    }
    setFocused(true)
  }

  function handleBlur() {
    blurTimer.current = setTimeout(() => {
      setFocused(false)
      blurTimer.current = null
    }, BLUR_DELAY_MS)
  }

  function handleSelect(entry: CityEntry) {
    if (blurTimer.current) {
      clearTimeout(blurTimer.current)
      blurTimer.current = null
    }
    onChangeText(`${entry.name}, ${entry.country}`)
    setFocused(false)
    Keyboard.dismiss()
  }

  return (
    <YStack gap="$2">
      <Input
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="done"
        onFocus={handleFocus}
        onBlur={handleBlur}
        accessibilityLabel={accessibilityLabel}
      />
      {listVisible && (
        <YStack
          backgroundColor="$color1"
          borderRadius="$4"
          borderWidth={1}
          borderColor="$color5"
          overflow="hidden"
          accessible
          accessibilityRole="list"
          accessibilityLabel="City suggestions"
        >
          {suggestions.map((entry, idx) => (
            <YStack
              key={`${entry.name}-${entry.country}`}
              paddingVertical="$3"
              paddingHorizontal="$4"
              minHeight={56}
              justifyContent="center"
              borderTopWidth={idx === 0 ? 0 : 1}
              borderTopColor="$color4"
              pressStyle={{ opacity: 0.75, backgroundColor: '$accent2' }}
              onPress={() => handleSelect(entry)}
              accessible
              accessibilityRole="button"
              accessibilityLabel={`${entry.name}, ${entry.country}`}
            >
              <SizableText size="$5" fontWeight="500" color="$color">
                {entry.name}
              </SizableText>
              <SizableText size="$3" color="$color10">
                {entry.country}
              </SizableText>
            </YStack>
          ))}
        </YStack>
      )}
    </YStack>
  )
}
