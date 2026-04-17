import { describe, it, expect } from 'vitest'
import { detectCrisis } from '../crisis-detector.js'

describe('detectCrisis', () => {
  it('returns not detected for normal messages', () => {
    const result = detectCrisis('How do I manage my dad wandering at night?')
    expect(result.detected).toBe(false)
  })

  it('detects "want to kill myself"', () => {
    const result = detectCrisis('I want to kill myself')
    expect(result).toMatchObject({ detected: true, resources: expect.stringContaining('988') })
  })

  it('detects "suicidal" keyword', () => {
    const result = detectCrisis("I've been feeling suicidal lately")
    expect(result).toMatchObject({ detected: true, resources: expect.stringContaining('988') })
  })

  it('detects "want to die"', () => {
    const result = detectCrisis('I just want to die')
    expect(result.detected).toBe(true)
  })

  it('detects "end my life"', () => {
    const result = detectCrisis('I want to end my life')
    expect(result.detected).toBe(true)
  })

  it('detects self-harm references', () => {
    const result = detectCrisis('I keep thinking about hurting myself')
    expect(result.detected).toBe(true)
  })

  it('detects elder abuse references', () => {
    const result = detectCrisis('I caught someone abusing my elderly parent')
    expect(result.detected).toBe(true)
    if (result.detected) {
      expect(result.resources).toContain('Adult Protective Services')
      expect(result.resources).toContain('1-800-677-1116')
    }
  })

  it('detects "no point in living"', () => {
    const result = detectCrisis("There's no point in living anymore")
    expect(result.detected).toBe(true)
  })

  it('does not trigger on general difficulty expressions', () => {
    const result = detectCrisis("Caregiving is killing me, I'm so exhausted")
    expect(result.detected).toBe(false)
  })

  it('includes crisis resources: 988, Crisis Text Line, APS, 911', () => {
    const result = detectCrisis('I want to end it all')
    expect(result.detected).toBe(true)
    if (result.detected) {
      expect(result.resources).toContain('988')
      expect(result.resources).toContain('741741')
      expect(result.resources).toContain('1-800-677-1116')
      expect(result.resources).toContain('911')
    }
  })
})
