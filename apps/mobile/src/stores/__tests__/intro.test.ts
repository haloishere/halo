import { describe, it, expect, beforeEach } from 'vitest'
import { useIntroStore } from '../intro'

beforeEach(() => {
  useIntroStore.setState({ hasSeen: false }, false)
})

describe('useIntroStore — initial state', () => {
  it('starts unseen', () => {
    expect(useIntroStore.getState().hasSeen).toBe(false)
  })
})

describe('useIntroStore — markSeen', () => {
  it('flips hasSeen to true', () => {
    useIntroStore.getState().markSeen()
    expect(useIntroStore.getState().hasSeen).toBe(true)
  })

  it('is idempotent', () => {
    useIntroStore.getState().markSeen()
    useIntroStore.getState().markSeen()
    expect(useIntroStore.getState().hasSeen).toBe(true)
  })
})
