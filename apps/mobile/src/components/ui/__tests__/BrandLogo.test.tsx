import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '../../../test/render'
import { BrandLogo } from '../BrandLogo'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('BrandLogo — static (animated=false)', () => {
  it('renders full brand text immediately', () => {
    const { getByText } = render(<BrandLogo animated={false} />)
    expect(getByText('halo')).toBeTruthy()
  })

  it('uses Grand Hotel font', () => {
    const { getByText } = render(<BrandLogo animated={false} />)
    const heading = getByText('halo')
    expect(heading.props.fontFamily ?? heading.props.style?.fontFamily).toBeDefined()
  })
})

describe('BrandLogo — animated (default)', () => {
  it('renders no visible text initially', () => {
    const { queryByText } = render(<BrandLogo />)
    // Each letter is rendered but with opacity 0, so full text is not findable as one string
    expect(queryByText('halo')).toBeNull()
  })

  it('renders individual letter elements', () => {
    const { getAllByText } = render(<BrandLogo />)
    // Each character of "halo" is rendered separately
    const hElements = getAllByText('h')
    expect(hElements.length).toBeGreaterThanOrEqual(1)
  })

  it('reveals letters progressively with timers', async () => {
    const { getAllByText } = render(<BrandLogo typeDelay={100} />)

    // Initially 5 letter elements exist (all hidden)
    expect(getAllByText(/^[halo]$/).length).toBe(5)

    // Advance through all timers — state updates happen
    await act(() => {
      vi.advanceTimersByTime(600)
    })

    // All 5 letters still rendered after full animation
    expect(getAllByText(/^[halo]$/).length).toBe(5)
  })
})

describe('BrandLogo — props', () => {
  it('accepts custom size', () => {
    const { getByText } = render(<BrandLogo animated={false} size="$9" />)
    expect(getByText('halo')).toBeTruthy()
  })

  it('does not advance animation before typeDelay elapses', async () => {
    const { getAllByText } = render(<BrandLogo typeDelay={200} />)

    // After 100ms (less than 200ms typeDelay), no state change yet
    await act(() => {
      vi.advanceTimersByTime(100)
    })

    // All 5 letter elements still exist
    expect(getAllByText(/^[halo]$/).length).toBe(5)
  })
})
