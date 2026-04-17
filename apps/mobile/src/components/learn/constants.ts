import type { ContentCategory } from '@halo/shared'

export const LEARN_TABS = ['for-you', 'topics', 'bookmarks', 'learning-path'] as const
export type LearnTabValue = (typeof LEARN_TABS)[number]

export const LEARN_TAB_LABELS: Record<LearnTabValue, string> = {
  'for-you': 'For You',
  topics: 'Topics',
  bookmarks: 'Bookmarks',
  'learning-path': 'Learning Path',
}

export interface ForYouSectionConfig {
  key: string
  title: string
  /** Empty array = all categories (e.g., Top Picks). */
  categories: ContentCategory[]
}

export const FOR_YOU_SECTIONS: readonly ForYouSectionConfig[] = [
  { key: 'top-picks', title: 'Top Picks', categories: [] },
  {
    key: 'better-care',
    title: 'Better Care',
    categories: ['daily_care', 'behavioral_management', 'safety'],
  },
  {
    key: 'better-life',
    title: 'Better Life',
    categories: ['self_care', 'communication'],
  },
  {
    key: 'experiences',
    title: 'Experiences & Stories',
    categories: ['understanding_disease', 'legal_financial'],
  },
]

export const MAX_SECTION_ITEMS = 8

/** Large border radius for pill-shaped elements (chips, badges) */
export const PILL_BORDER_RADIUS = 999
