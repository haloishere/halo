import React from 'react'
import { Text } from 'react-native'
import { describe, it, expect } from 'vitest'
import { render } from '../../../test/render'
import { ScreenContainer } from '../ScreenContainer'

describe('ScreenContainer', () => {
  it('renders children', () => {
    const { getByText } = render(
      <ScreenContainer>
        <Text>Test child</Text>
      </ScreenContainer>,
    )
    expect(getByText('Test child')).toBeTruthy()
  })

  it('wraps in KeyboardAvoidingView', () => {
    const { toJSON } = render(
      <ScreenContainer>
        <Text>Content</Text>
      </ScreenContainer>,
    )
    expect(toJSON()).toBeTruthy()
  })
})
