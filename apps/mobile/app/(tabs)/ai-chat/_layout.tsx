/**
 * Nested Stack navigator for the Chat tab.
 *
 * Critical topology choice: the chat detail screen lives inside this
 * nested stack (`[id].tsx`) rather than at the root stack level.
 * That puts the Tabs navigator *below* any chat screen in the
 * navigation tree, so Android's hardware back button pops from chat
 * detail → the previously-focused tab (home), instead of the app
 * closing entirely.
 *
 * Previous attempts with `app/chat/[id].tsx` at the root level all
 * broke hardware back because `<Redirect>` from the tab leaf compiles
 * to `router.replace` at the ROOT stack — wiping the `(tabs)` entry
 * and leaving an empty parent-less stack. That failure mode is
 * structurally impossible in the current topology because the
 * Tabs navigator is the parent container.
 *
 * Screens in this stack:
 *   - `index` — tiny `<Redirect>` that reads `useLastChatStore` and
 *     sends the user to `[id]` or `/ai-chat/new` on every focus.
 *   - `[id]` — the actual chat detail UI (messages, input, welcome
 *     greeting, crisis banner, streaming).
 *   - `history` — conversation list, reached from the chat detail
 *     header's clock icon via `router.push('/ai-chat/history')`.
 */
import { Stack } from 'expo-router'

export default function AiChatLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
}
