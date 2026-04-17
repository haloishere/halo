import { create } from 'zustand'

/**
 * Ephemeral chat state — streaming progress, pending-message optimistic
 * UI, crisis-resources banner. This store is deliberately NOT persisted.
 * Any field that must survive a cold start (e.g. last opened chat id)
 * belongs in `src/stores/last-chat.ts`, which has its own persist
 * middleware.
 */
interface ChatState {
  activeConversationId: string | null
  pendingUserMessage: string | null
  streamingMessage: string
  isStreaming: boolean
  streamError: string | null
  crisisResources: string | null
  setActiveConversation: (id: string | null) => void
  setPendingUserMessage: (content: string | null) => void
  appendChunk: (text: string) => void
  startStreaming: (userMessage: string) => void
  finishStreaming: () => void
  setStreamError: (error: string | null) => void
  setCrisisResources: (resources: string | null) => void
  resetStreamingState: () => void
}

export const useChatStore = create<ChatState>((set) => ({
  activeConversationId: null,
  pendingUserMessage: null,
  streamingMessage: '',
  isStreaming: false,
  streamError: null,
  crisisResources: null,

  setActiveConversation: (id) =>
    set((state) => ({
      activeConversationId: id,
      // Preserve optimistic streaming state during the sentinel→realId
      // transition: when `router.setParams` fires mid-stream, Effect 1
      // calls this with the real id before the stream completes. Clearing
      // pendingUserMessage/streamingMessage here would blank the chat UI.
      // When NOT streaming (normal conversation switch), clear as before.
      ...(state.isStreaming ? {} : { pendingUserMessage: null, streamingMessage: '' }),
      streamError: null,
      crisisResources: null,
    })),

  setPendingUserMessage: (content) => set({ pendingUserMessage: content }),

  appendChunk: (text) => set((state) => ({ streamingMessage: state.streamingMessage + text })),

  startStreaming: (userMessage) =>
    set({
      isStreaming: true,
      pendingUserMessage: userMessage,
      streamingMessage: '',
      streamError: null,
      crisisResources: null,
    }),

  finishStreaming: () =>
    set({ isStreaming: false, streamingMessage: '', pendingUserMessage: null }),

  setStreamError: (error) =>
    set({ streamError: error, isStreaming: false, pendingUserMessage: null, streamingMessage: '' }),

  setCrisisResources: (resources) => set({ crisisResources: resources }),

  resetStreamingState: () =>
    set({
      pendingUserMessage: null,
      streamingMessage: '',
      isStreaming: false,
      streamError: null,
      crisisResources: null,
    }),
}))
