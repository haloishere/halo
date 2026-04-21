export const VAULT_TOPICS = [
  'food_and_restaurants',
  'fashion',
  'lifestyle_and_travel',
] as const

export type VaultTopic = (typeof VAULT_TOPICS)[number]
