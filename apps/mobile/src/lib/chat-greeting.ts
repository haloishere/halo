/**
 * Time-of-day and greeting text for the AI assistant welcome state.
 *
 * Pure, client-only. No React, no stores, no imports — the output is computed
 * at render time in the chat screen when a conversation has zero messages.
 *
 * Buckets (strict left-inclusive, right-exclusive intervals):
 *   05:00–12:00 → morning
 *   12:00–17:00 → afternoon
 *   17:00–22:00 → evening
 *   22:00–05:00 → lateNight (the only bucket that wraps past midnight —
 *                 any future bucket added to `TimeOfDay` must NOT span
 *                 midnight or the simple `hour <` chain in `getTimeOfDay`
 *                 will break.)
 *
 * ## Timezone semantics
 *
 * `date.getHours()` reads the DEVICE local timezone, not the user's
 * account-level timezone or GPS location. A caregiver travelling across
 * timezones will see "good morning" matched to their phone's clock, not
 * their home timezone. This is intentional: the greeting should match the
 * time the user perceives, not the time the server or an account setting
 * thinks it is.
 *
 * The boundaries are locked by boundary tests — do not move them without
 * updating the matching `describe` block in the test suite.
 */

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'lateNight'

/**
 * Title string shape — the exact prefix is guaranteed at the type level so
 * that a future refactor dropping the `"Good "` prefix fails to compile
 * rather than silently shipping broken copy. `GreetingTitle` is the union
 * of the four template literals matching the four buckets.
 */
export type GreetingTitle =
  | `Good morning, ${string}`
  | `Good afternoon, ${string}`
  | `Good evening, ${string}`
  | `Hi, ${string}`

export interface Greeting {
  title: GreetingTitle
  subtitle: string
  timeOfDay: TimeOfDay
}

/** Returns the caller's local time-of-day bucket. Defaults to `new Date()`. */
export function getTimeOfDay(date: Date = new Date()): TimeOfDay {
  const hour = date.getHours()
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 22) return 'evening'
  return 'lateNight' // [22, 24) or [0, 5) — the only midnight-wrapping bucket
}

/**
 * Extract a first name from a (potentially multi-word, messy) display name.
 * Falls back to "there" when there's nothing usable.
 *
 * `String.prototype.trim()` handles Unicode whitespace including NBSP
 * (U+00A0), and `/\s+/` uses the same whitespace class — so a name like
 * `"Amir\u00A0Jalali"` pasted from iOS contacts still splits correctly.
 *
 * Kept internal (not exported) because the `"there"` fallback is
 * greeting-specific copy; other consumers should build their own fallback
 * rather than risk "Hi there" showing up in a non-greeting context.
 */
function firstName(displayName: string | null | undefined): string {
  if (displayName == null) return 'there'
  const trimmed = displayName.trim()
  if (trimmed.length === 0) return 'there'
  // After the guards above, `split(/\s+/)[0]` is always a non-empty string.
  // Using `?? 'there'` instead of a non-null assertion keeps the invariant
  // self-documenting and strict-mode happy without a load-bearing comment.
  return trimmed.split(/\s+/)[0] ?? 'there'
}

/**
 * Copy templates per time-of-day.
 *
 * `satisfies Record<TimeOfDay, ...>` gives compile-time exhaustiveness — any
 * new `TimeOfDay` variant forces a corresponding entry here or the build
 * fails. Unlike a plain `Record<...>` annotation, `satisfies` preserves the
 * narrower template-literal return types of each arrow function, so the
 * inferred title shape still satisfies `GreetingTitle` when passed through
 * `buildGreeting` below. Centralising the strings also keeps them
 * discoverable for a future i18n pass (though i18n itself will need more
 * than a string-move — see the plan doc).
 */
const GREETING_TEMPLATES = {
  morning: (name: string) => ({
    title: `Good morning, ${name}` as const,
    subtitle: "Take your time. I'm here." as const,
  }),
  afternoon: (name: string) => ({
    title: `Good afternoon, ${name}` as const,
    subtitle: "What's on your mind?" as const,
  }),
  evening: (name: string) => ({
    title: `Good evening, ${name}` as const,
    subtitle: 'How was your day?' as const,
  }),
  lateNight: (name: string) => ({
    title: `Hi, ${name}` as const,
    subtitle: "It's okay to be awake. I'm here." as const,
  }),
} satisfies Record<TimeOfDay, (name: string) => { title: GreetingTitle; subtitle: string }>

/**
 * Build a time-aware welcome greeting for a given display name.
 *
 * @param displayName - the user's full display name (may be null/undefined for
 *   logged-out or pre-sync states).
 * @param date - optional clock override for tests; defaults to `new Date()`.
 */
export function buildGreeting(
  displayName: string | null | undefined,
  date: Date = new Date(),
): Greeting {
  const timeOfDay = getTimeOfDay(date)
  const name = firstName(displayName)
  // eslint-disable-next-line security/detect-object-injection -- `timeOfDay` is a closed TypeScript union (`TimeOfDay`), not user input. The key set is proven at compile time via `satisfies Record<TimeOfDay, ...>`.
  return { ...GREETING_TEMPLATES[timeOfDay](name), timeOfDay }
}
