import { useCallback, useMemo, useState } from 'react'
import { RefreshControl } from 'react-native'
import { Input, ScrollView, Separator, XStack, YStack } from 'tamagui'
import { Search, BookOpen, X } from '@tamagui/lucide-icons'
import { CONTENT_CATEGORIES, type ContentCategory, type ContentListItem } from '@halo/shared'
import { EmptyState, FilterChips } from '../ui'
import { getCategoryLabel } from '../../lib/content-utils'
import { ForYouSection } from './ForYouSection'
import { FOR_YOU_SECTIONS } from './constants'
import { useDebounce } from '../../hooks/useDebounce'

interface ForYouTabProps {
  items: ContentListItem[]
  isLoading: boolean
  isError: boolean
  isRefetching: boolean
  onRefresh: () => void
  onArticlePress: (slug: string) => void
  onBookmarkToggle: (id: string) => void
}

const scrollContentStyle = { paddingTop: 8, paddingBottom: 24, paddingHorizontal: 24 } as const

function filterItemsForSection(
  items: ContentListItem[],
  categories: ContentCategory[],
  selectedCategory: ContentCategory | undefined,
  searchQuery: string,
): ContentListItem[] {
  let filtered = items

  if (categories.length > 0) {
    const catSet = new Set<string>(categories)
    filtered = filtered.filter((item) => catSet.has(item.category))
  }

  if (selectedCategory) {
    filtered = filtered.filter((item) => item.category === selectedCategory)
  }

  if (searchQuery) {
    const query = searchQuery.toLowerCase()
    filtered = filtered.filter((item) => item.title.toLowerCase().includes(query))
  }

  return filtered
}

export function ForYouTab({
  items,
  isLoading,
  isError,
  isRefetching,
  onRefresh,
  onArticlePress,
  onBookmarkToggle,
}: ForYouTabProps) {
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<ContentCategory | undefined>(undefined)
  const debouncedSearch = useDebounce(search, 300)

  const sections = useMemo(
    () =>
      FOR_YOU_SECTIONS.map((section) => ({
        ...section,
        items: filterItemsForSection(
          items,
          section.categories as ContentCategory[],
          selectedCategory,
          debouncedSearch,
        ),
      })),
    [items, selectedCategory, debouncedSearch],
  )

  const handleClearSearch = useCallback(() => {
    setSearch('')
  }, [])

  return (
    <YStack flex={1}>
      <YStack paddingHorizontal="$6" paddingTop="$4">
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
            placeholder="Search articles..."
            value={search}
            onChangeText={setSearch}
            size="$4"
            color="$color"
            placeholderTextColor="$color6"
            paddingHorizontal="$2.5"
            accessibilityLabel="Search articles"
          />
          {search.length > 0 && (
            <XStack
              pressStyle={{ opacity: 0.7 }}
              onPress={handleClearSearch}
              padding="$1"
              accessible
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <X size={18} color="$color8" />
            </XStack>
          )}
        </XStack>
      </YStack>

      <FilterChips
        items={CONTENT_CATEGORIES}
        selected={selectedCategory}
        onSelect={setSelectedCategory}
        getLabel={getCategoryLabel}
      />

      <ScrollView
        flex={1}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={scrollContentStyle}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} />}
      >
        <YStack gap="$5">
          {sections
            .filter((section) => section.items.length > 0)
            .map((section, index) => (
              <YStack key={section.key}>
                {index > 0 && <Separator marginBottom="$4" />}
                <ForYouSection
                  title={section.title}
                  items={section.items}
                  onArticlePress={onArticlePress}
                  onBookmarkToggle={onBookmarkToggle}
                />
              </YStack>
            ))}
        </YStack>

        {isLoading && <EmptyState icon={BookOpen} title="No articles found" isLoading />}

        {!isLoading && items.length === 0 && (
          <EmptyState
            icon={BookOpen}
            title={isError ? 'Failed to load articles' : 'No articles found'}
            subtitle={isError ? 'Pull down to try again' : undefined}
          />
        )}
      </ScrollView>
    </YStack>
  )
}
