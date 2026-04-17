import { describe, it, expect } from 'vitest'
import { CONTENT_CATEGORIES } from '@halo/shared'
import {
  LEARN_TABS,
  LEARN_TAB_LABELS,
  FOR_YOU_SECTIONS,
  MAX_SECTION_ITEMS,
  PILL_BORDER_RADIUS,
} from './constants'

describe('LEARN_TABS', () => {
  it('has exactly 4 tabs', () => {
    expect(LEARN_TABS).toHaveLength(4)
  })

  it('has a label for every tab', () => {
    for (const tab of LEARN_TABS) {
      expect(LEARN_TAB_LABELS[tab]).toBeTruthy()
    }
  })
})

describe('FOR_YOU_SECTIONS', () => {
  it('has 4 sections', () => {
    expect(FOR_YOU_SECTIONS).toHaveLength(4)
  })

  it('first section (Top Picks) has empty categories array', () => {
    expect(FOR_YOU_SECTIONS[0]!.key).toBe('top-picks')
    expect(FOR_YOU_SECTIONS[0]!.categories).toEqual([])
  })

  it('all non-empty categories reference valid CONTENT_CATEGORIES', () => {
    const validCategories = new Set(CONTENT_CATEGORIES)
    for (const section of FOR_YOU_SECTIONS) {
      for (const cat of section.categories) {
        expect(validCategories.has(cat)).toBe(true)
      }
    }
  })

  it('covers all 7 content categories across sections (excluding Top Picks)', () => {
    const covered = new Set(FOR_YOU_SECTIONS.flatMap((s) => s.categories))
    for (const cat of CONTENT_CATEGORIES) {
      expect(covered.has(cat)).toBe(true)
    }
  })

  it('each section has a unique key', () => {
    const keys = FOR_YOU_SECTIONS.map((s) => s.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('MAX_SECTION_ITEMS', () => {
  it('is a positive number', () => {
    expect(MAX_SECTION_ITEMS).toBeGreaterThan(0)
  })
})

describe('PILL_BORDER_RADIUS', () => {
  it('is a large number for pill shape', () => {
    expect(PILL_BORDER_RADIUS).toBeGreaterThanOrEqual(999)
  })
})
