import React from 'react'
import { describe, it, expect } from 'vitest'
import { render } from '../../../test/render'
import { Divider } from '../Divider'

describe('Divider', () => {
  it('renders a Separator', () => {
    const { toJSON } = render(<Divider />)
    expect(toJSON()).toBeTruthy()
  })

  it('renders label text between two Separators when label provided', () => {
    const { getByText } = render(<Divider label="or" />)
    expect(getByText('or')).toBeTruthy()
  })
})
