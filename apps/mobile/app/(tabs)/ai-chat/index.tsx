/**
 * AI Chat tab entry — `<Redirect>` into the current chat.
 *
 * This file is intentionally tiny. The entire tab behavior is:
 * "given the persisted lastChatId + its updatedAt, send the user to
 * `/ai-chat/{id}` if fresh or `/ai-chat/new` if stale/unknown".
 *
 * ## Why `<Redirect>` inside a NESTED stack
 *
 * The earlier attempt to use `<Redirect>` from `app/(tabs)/ai-chat.tsx`
 * (a tab leaf) failed because `<Redirect>`'s target
 * (`app/chat/[id].tsx`, a sibling of `(tabs)`) was at the ROOT stack
 * level. expo-router's redirect compiles to `router.replace` against
 * the root stack in that topology, wiping `(tabs)` entirely — so
 * Android hardware back had nothing to pop and closed the app.
 *
 * The fix is topological, not flag-based: `[id].tsx` is now a SIBLING
 * of this `index.tsx` inside `app/(tabs)/ai-chat/`, both children of
 * the nested `_layout.tsx` stack. `<Redirect>` here replaces `index`
 * with `[id]` INSIDE that nested stack, and the Tabs navigator still
 * holds the `(tabs)/ai-chat` entry underneath. Hardware back pops
 * the nested stack, and when that's empty the Tabs navigator back
 * handler takes over — popping back to whichever tab the user came
 * from (home on cold start).
 *
 * Re-tap the Chat tab later → this file re-mounts → re-reads the
 * persisted store → re-redirects to the current most-recent chat.
 * No flag, no gate, no list body, no spinner. The tab never "sticks"
 * on a loading state because this file never renders anything other
 * than `<Redirect>`.
 *
 * ## Data source
 *
 * `useLastChatStore` — zustand + persist (AsyncStorage). The chat
 * detail screen (`[id].tsx`) writes to this store on every focus
 * for a real id. No `useConversationsQuery()` call here — the hot
 * path has zero network dependency.
 */
import { Redirect } from 'expo-router'
import { useLastChatStore } from '../../../src/stores/last-chat'
import { shouldResumeTimestamp, NEW_CHAT_SENTINEL } from '../../../src/lib/chat-resume'

export default function AiChatIndex() {
  const lastChatId = useLastChatStore((s) => s.lastChatId)
  const lastChatUpdatedAt = useLastChatStore((s) => s.lastChatUpdatedAt)

  const now = new Date()
  const canResume = lastChatId != null && shouldResumeTimestamp(lastChatUpdatedAt, now)

  const href = canResume ? `/ai-chat/${lastChatId}` : `/ai-chat/${NEW_CHAT_SENTINEL}`

  return <Redirect href={href} />
}
