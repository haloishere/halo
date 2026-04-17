import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '../../../test/render'
import { MessageInput } from '../MessageInput'

vi.mock('@tamagui/lucide-icons', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- vi.mock factory must use require
  const { Text } = require('react-native')
  return {
    Send: (props: Record<string, unknown>) => <Text testID="icon-send" {...props} />,
  }
})

describe('MessageInput', () => {
  it('renders without crashing', () => {
    const { toJSON } = render(<MessageInput onSend={vi.fn()} />)
    expect(toJSON()).toBeTruthy()
  })

  it('renders the send button', () => {
    const { getByRole } = render(<MessageInput onSend={vi.fn()} />)

    // Send button is rendered with role="button"
    expect(getByRole('button')).toBeTruthy()
  })

  it('does not call onSend when disabled', () => {
    const onSend = vi.fn()
    const { UNSAFE_getByProps } = render(<MessageInput onSend={onSend} disabled />)

    const input = UNSAFE_getByProps({ placeholder: 'Type a message...' })
    fireEvent.changeText(input, 'Hello')
    // Use submitEditing to bypass the visually-disabled button;
    // handleSend's disabled guard is what must block the call.
    fireEvent(input, 'submitEditing')

    expect(onSend).not.toHaveBeenCalled()
  })

  it('renders with custom placeholder', () => {
    const { toJSON } = render(<MessageInput onSend={vi.fn()} placeholder="Ask Halo..." />)
    expect(toJSON()).toBeTruthy()
  })

  it('calls onSend with trimmed text on button press', () => {
    const onSend = vi.fn()
    // Tamagui Input renders as <textarea> in JSDOM — use UNSAFE_getByProps
    const { UNSAFE_getByProps, getByRole } = render(<MessageInput onSend={onSend} />)

    const input = UNSAFE_getByProps({ placeholder: 'Type a message...' })
    fireEvent.changeText(input, '  Hello world  ')
    fireEvent.press(getByRole('button'))

    expect(onSend).toHaveBeenCalledWith('Hello world')
  })

  it('does not call onSend when only whitespace is entered', () => {
    const onSend = vi.fn()
    const { UNSAFE_getByProps, getByRole } = render(<MessageInput onSend={onSend} />)

    const input = UNSAFE_getByProps({ placeholder: 'Type a message...' })
    fireEvent.changeText(input, '   ')
    fireEvent.press(getByRole('button'))

    expect(onSend).not.toHaveBeenCalled()
  })

  it('calls onSend via keyboard submit (returnKeyType="send")', () => {
    const onSend = vi.fn()
    const { UNSAFE_getByProps } = render(<MessageInput onSend={onSend} />)

    const input = UNSAFE_getByProps({ placeholder: 'Type a message...' })
    fireEvent.changeText(input, 'Hello keyboard')
    fireEvent(input, 'submitEditing')

    expect(onSend).toHaveBeenCalledWith('Hello keyboard')
  })

  it('isSendingRef blocks a re-entrant press fired before setText flushes', () => {
    // Fire a second press from *inside* the onSend callback, before setText('')
    // has committed. At that point text is still 'Hello', so !trimmed cannot
    // explain the block — only isSendingRef.current === true can.
    // Container object so `const` can be used (prefer-const disallows
    // `let` for variables assigned only once, even with a forward reference).
    const capture: { getByRole: ReturnType<typeof render>['getByRole'] | null } = {
      getByRole: null,
    }

    const onSend = vi.fn().mockImplementationOnce(() => {
      fireEvent.press(capture.getByRole!('button'))
    })

    const { UNSAFE_getByProps, getByRole } = render(<MessageInput onSend={onSend} />)
    capture.getByRole = getByRole

    const input = UNSAFE_getByProps({ placeholder: 'Type a message...' })
    fireEvent.changeText(input, 'Hello')
    fireEvent.press(getByRole('button'))

    expect(onSend).toHaveBeenCalledTimes(1)
    expect(onSend).toHaveBeenCalledWith('Hello')
  })

  it('guard stays active after a successful send until disabled cycles (blocks rapid real-device taps)', () => {
    // On a real device, two rapid taps arrive as separate JS events.
    // handleSend returns after the first tap, but isSendingRef stays true
    // because try/catch (not finally) only resets on throw — the useEffect
    // resets it when disabled transitions false → true → false.
    const onSend = vi.fn()
    const { UNSAFE_getByProps, getByRole } = render(<MessageInput onSend={onSend} />)

    const input = UNSAFE_getByProps({ placeholder: 'Type a message...' })
    fireEvent.changeText(input, 'First')
    fireEvent.press(getByRole('button'))
    expect(onSend).toHaveBeenCalledTimes(1)

    // Second tap: disabled hasn't cycled yet, isSendingRef is still true
    fireEvent.changeText(input, 'Second')
    fireEvent.press(getByRole('button'))

    expect(onSend).toHaveBeenCalledTimes(1)
  })

  it('resets guard when disabled cycles false → true → false (streaming ends)', () => {
    const onSend = vi.fn()
    const { UNSAFE_getByProps, getByRole, rerender } = render(
      <MessageInput onSend={onSend} disabled={false} />,
    )

    const input = UNSAFE_getByProps({ placeholder: 'Type a message...' })
    fireEvent.changeText(input, 'First')
    fireEvent.press(getByRole('button'))
    expect(onSend).toHaveBeenCalledTimes(1)

    // Streaming cycle: parent sets disabled=true, then false when response arrives
    rerender(<MessageInput onSend={onSend} disabled={true} />)
    rerender(<MessageInput onSend={onSend} disabled={false} />)

    fireEvent.changeText(input, 'Second')
    fireEvent.press(getByRole('button'))

    expect(onSend).toHaveBeenCalledTimes(2)
    expect(onSend).toHaveBeenLastCalledWith('Second')
  })

  it('resets the send guard even when onSend throws, allowing the next send', () => {
    const onSend = vi.fn().mockImplementationOnce(() => {
      throw new Error('stream failed')
    })
    const { UNSAFE_getByProps, getByRole } = render(<MessageInput onSend={onSend} />)

    const input = UNSAFE_getByProps({ placeholder: 'Type a message...' })
    fireEvent.changeText(input, 'Hello')
    // First press — onSend throws, guard must still reset
    expect(() => fireEvent.press(getByRole('button'))).toThrow('stream failed')

    // Guard should be clear; user can send again after typing
    fireEvent.changeText(input, 'Retry')
    fireEvent.press(getByRole('button'))

    expect(onSend).toHaveBeenCalledTimes(2)
    expect(onSend).toHaveBeenLastCalledWith('Retry')
  })

  it('clears the input after successful send', () => {
    const onSend = vi.fn()
    const { UNSAFE_getByProps, getByRole } = render(<MessageInput onSend={onSend} />)

    const input = UNSAFE_getByProps({ placeholder: 'Type a message...' })
    fireEvent.changeText(input, 'Hello')
    fireEvent.press(getByRole('button'))

    expect(onSend).toHaveBeenCalledWith('Hello')
    // After send, the text should be cleared (value reset to '')
    expect(input.props.value).toBe('')
  })
})
