import React from 'react'
import { Linking } from 'react-native'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '../../../test/render'
import { CrisisResources } from '../CrisisResources'

vi.mock('@tamagui/lucide-icons', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- vi.mock factory must use require
  const { Text } = require('react-native')
  return {
    Phone: (props: Record<string, unknown>) => <Text testID="icon-phone" {...props} />,
  }
})

beforeEach(() => {
  vi.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never)
})

describe('CrisisResources', () => {
  it('renders crisis resources heading', () => {
    const { getByText } = render(<CrisisResources />)

    expect(getByText('Crisis Resources')).toBeTruthy()
  })

  it('renders 988 button', () => {
    const { getByText } = render(<CrisisResources />)

    expect(getByText(/988 Suicide & Crisis Lifeline/)).toBeTruthy()
  })

  it('renders Crisis Text Line button', () => {
    const { getByText } = render(<CrisisResources />)

    expect(getByText(/Crisis Text Line/)).toBeTruthy()
  })

  it('renders Adult Protective Services button', () => {
    const { getByText } = render(<CrisisResources />)

    expect(getByText(/Adult Protective Services/)).toBeTruthy()
  })

  it('opens tel:988 on 988 button press', () => {
    const { getByText } = render(<CrisisResources />)

    fireEvent.press(getByText(/988 Suicide & Crisis Lifeline/))

    expect(Linking.openURL).toHaveBeenCalledWith('tel:988')
  })

  it('opens SMS for Crisis Text Line press', () => {
    const { getByText } = render(<CrisisResources />)

    fireEvent.press(getByText(/Crisis Text Line/))

    expect(Linking.openURL).toHaveBeenCalledWith('sms:741741?body=HOME')
  })

  it('opens tel for Adult Protective Services press', () => {
    const { getByText } = render(<CrisisResources />)

    fireEvent.press(getByText(/Adult Protective Services/))

    expect(Linking.openURL).toHaveBeenCalledWith('tel:18006771116')
  })
})
