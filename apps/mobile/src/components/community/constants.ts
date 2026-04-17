export const COMMUNITY_TABS = ['explore', 'following', 'spotlight'] as const
export type CommunityTabValue = (typeof COMMUNITY_TABS)[number]

export const COMMUNITY_TAB_LABELS: Record<CommunityTabValue, string> = {
  explore: 'Explore',
  following: 'Following',
  spotlight: 'Spotlight',
}
