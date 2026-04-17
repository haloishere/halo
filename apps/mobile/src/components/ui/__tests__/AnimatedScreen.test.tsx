import React from 'react'
import { describe, it, expect } from 'vitest'
import { Text } from 'react-native'
import { render } from '../../../test/render'
import { AnimatedScreen } from '../AnimatedScreen'

describe('AnimatedScreen', () => {
  it('renders children', () => {
    const { getByText } = render(
      <AnimatedScreen>
        <Text>Hello</Text>
      </AnimatedScreen>,
    )
    expect(getByText('Hello')).toBeTruthy()
  })

  it('renders without crashing when given no children', () => {
    const { toJSON } = render(<AnimatedScreen>{null}</AnimatedScreen>)
    expect(toJSON()).toBeTruthy()
  })
})
