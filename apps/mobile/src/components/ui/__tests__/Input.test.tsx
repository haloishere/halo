import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '../../../test/render'
import { Input } from '../Input'

describe('Input — rendering', () => {
  it('renders with placeholder', () => {
    const { getByLabelText } = render(
      <Input placeholder="Enter text" accessibilityLabel="text input" />,
    )
    expect(getByLabelText('text input')).toBeTruthy()
  })

  it('renders label when provided', () => {
    const { getByText } = render(<Input label="Email" placeholder="Enter email" />)
    expect(getByText('Email')).toBeTruthy()
  })

  it('renders error message when error prop set', () => {
    const { getByText } = render(<Input error="Required field" placeholder="Enter text" />)
    expect(getByText('Required field')).toBeTruthy()
  })

  it('does not render label when not provided', () => {
    const { queryByText } = render(<Input placeholder="No label" />)
    expect(queryByText('Email')).toBeNull()
  })

  it('does not render error when not set', () => {
    const { queryByText } = render(<Input placeholder="No error" />)
    expect(queryByText('Required field')).toBeNull()
  })
})

describe('Input — interaction', () => {
  it('calls onChangeText', () => {
    const onChangeText = vi.fn()
    const { getByLabelText } = render(
      <Input placeholder="Type here" accessibilityLabel="type input" onChangeText={onChangeText} />,
    )
    fireEvent.changeText(getByLabelText('type input'), 'hello')
    expect(onChangeText).toHaveBeenCalledWith('hello')
  })

  it('forwards onFocus callback', () => {
    const onFocus = vi.fn()
    const { getByLabelText } = render(
      <Input placeholder="Focus test" accessibilityLabel="focus input" onFocus={onFocus} />,
    )
    const input = getByLabelText('focus input')
    // Tamagui Input internally reads e.target — provide a synthetic event
    fireEvent(input, 'focus', { target: input, nativeEvent: {} })
    expect(onFocus).toHaveBeenCalled()
  })

  it('forwards onBlur callback', () => {
    const onBlur = vi.fn()
    const { getByLabelText } = render(
      <Input placeholder="Blur test" accessibilityLabel="blur input" onBlur={onBlur} />,
    )
    const input = getByLabelText('blur input')
    // Tamagui Input internally reads e.nativeEvent — provide a synthetic event
    fireEvent(input, 'blur', { target: input, nativeEvent: {} })
    expect(onBlur).toHaveBeenCalled()
  })
})
