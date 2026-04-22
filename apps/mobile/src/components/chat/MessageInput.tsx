import { useEffect, useRef, useState } from 'react'
import { styled, XStack, TextArea } from 'tamagui'
import { Send } from '@tamagui/lucide-icons'
import { Button } from '../ui/Button'

const InputBar = styled(XStack, {
  padding: '$3',
  gap: '$2',
  alignItems: 'flex-end',
  backgroundColor: '$color2',
  borderTopWidth: 1,
  borderTopColor: '$color4',
})

const ChatTextArea = styled(TextArea, {
  flex: 1,
  borderWidth: 1.5,
  borderColor: '$color6',
  borderRadius: '$4',
  paddingHorizontal: '$3',
  paddingVertical: '$2.5',
  backgroundColor: '$color1',
  color: '$color',
  minHeight: 40,
  maxHeight: 120,

  focusStyle: {
    borderColor: '$accent7',
  },
})

// TODO(tamagui-v2-stable): Spread pattern bypasses Tamagui v2 RC type gap on placeholderTextColor
const placeholderStyle = { placeholderTextColor: '$color6' } as Record<string, unknown>

export interface MessageInputProps {
  onSend: (text: string) => void
  /** Load-bearing for the duplicate-send guard: the parent MUST cycle this
   *  prop false → true → false after each send (e.g. via isStreaming) so
   *  isSendingRef resets and the user can send a subsequent message. */
  disabled?: boolean
  placeholder?: string
  /** Pre-fills the input — used when a home-screen chip carries a prompt. */
  initialValue?: string
}

export function MessageInput({
  onSend,
  disabled = false,
  placeholder = 'Type a message...',
  initialValue,
}: MessageInputProps) {
  const [text, setText] = useState(initialValue ?? '')
  const isSendingRef = useRef(false)

  // Keep the guard active until streaming ends (disabled → false).
  // This blocks rapid taps that arrive as separate JS events — by the
  // time a second native tap fires, handleSend has already returned
  // but the ref is still true, so the guard holds until the parent
  // re-renders with disabled=false after the stream completes.
  useEffect(() => {
    if (!disabled) isSendingRef.current = false
  }, [disabled])

  function handleSend() {
    const trimmed = text.trim()
    if (!trimmed || disabled || isSendingRef.current) return
    isSendingRef.current = true
    try {
      onSend(trimmed)
      setText('')
    } catch (err) {
      // Defensive: async functions return rejected Promises rather than
      // throwing synchronously, so this branch is only reachable if onSend
      // is ever wired to a non-async handler. Reset so the user can retry.
      isSendingRef.current = false
      throw err
    }
  }

  return (
    <InputBar>
      <ChatTextArea
        value={text}
        onChangeText={setText}
        placeholder={placeholder}
        maxLength={5000}
        disabled={disabled}
        returnKeyType="send"
        onSubmitEditing={handleSend}
        blurOnSubmit={false}
        {...placeholderStyle}
      />
      <Button
        label=""
        icon={<Send size={18} color="$color1" />}
        onPress={handleSend}
        disabled={disabled || !text.trim()}
        variant="primary"
      />
    </InputBar>
  )
}
