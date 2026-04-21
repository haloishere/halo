export const VAULT_TOPICS = [
  'food_and_restaurants',
  'fashion',
  'lifestyle_and_travel',
] as const

export type VaultTopic = (typeof VAULT_TOPICS)[number]

/**
 * Human-readable labels for each topic. Consumed by mobile UI (chat header
 * topic badge, Portrait tab section titles, scenario picker card titles) and
 * anywhere else a user-facing string is needed. `satisfies` gives compile-time
 * exhaustiveness — adding a new value to `VAULT_TOPICS` forces a label update.
 */
export const TOPIC_LABELS = {
  food_and_restaurants: 'Food & Restaurants',
  fashion: 'Fashion',
  lifestyle_and_travel: 'Lifestyle & Travel',
} as const satisfies Record<VaultTopic, string>
