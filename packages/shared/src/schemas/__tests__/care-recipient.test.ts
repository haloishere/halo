import { describe, it, expect } from 'vitest'
import { CAREGIVER_RELATIONSHIPS, DIAGNOSIS_STAGES } from '../../constants/enums'
import { createCareRecipientSchema, updateCareRecipientSchema } from '../care-recipient'

describe('createCareRecipientSchema', () => {
  it('accepts valid input', () => {
    const result = createCareRecipientSchema.safeParse({
      name: 'Robert Doe',
      relationship: 'spouse',
      diagnosisStage: 'middle',
    })
    expect(result.success).toBe(true)
  })

  it('accepts full input with optional fields', () => {
    const result = createCareRecipientSchema.safeParse({
      name: 'Robert Doe',
      relationship: 'child',
      diagnosisStage: 'early',
      diagnosisDetails: 'Diagnosed in 2024, mild cognitive impairment progressing',
      dateOfBirth: '1950-03-15',
    })
    expect(result.success).toBe(true)
  })

  it('accepts all valid relationship enum values', () => {
    for (const relationship of CAREGIVER_RELATIONSHIPS) {
      const result = createCareRecipientSchema.safeParse({
        name: 'Robert Doe',
        relationship,
        diagnosisStage: 'middle',
      })
      expect(result.success, `Expected '${relationship}' to be valid`).toBe(true)
    }
  })

  it('rejects invalid relationship value', () => {
    const result = createCareRecipientSchema.safeParse({
      name: 'Robert Doe',
      relationship: 'Father',
      diagnosisStage: 'middle',
    })
    expect(result.success).toBe(false)
  })

  it('rejects unknown relationship values', () => {
    for (const invalid of ['friend', 'cousin', 'neighbor', '']) {
      const result = createCareRecipientSchema.safeParse({
        name: 'Robert Doe',
        relationship: invalid,
        diagnosisStage: 'middle',
      })
      expect(result.success, `Expected '${invalid}' to be invalid`).toBe(false)
    }
  })

  it('produces invalid_enum_value error code for bad relationship', () => {
    const result = createCareRecipientSchema.safeParse({
      name: 'Robert Doe',
      relationship: 'Father',
      diagnosisStage: 'middle',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const relError = result.error.issues.find((i) => i.path[0] === 'relationship')
      expect(relError?.code).toBe('invalid_enum_value')
    }
  })

  it('rejects empty name', () => {
    const result = createCareRecipientSchema.safeParse({
      name: '',
      relationship: 'spouse',
      diagnosisStage: 'middle',
    })
    expect(result.success).toBe(false)
  })

  it('rejects name exceeding 100 chars', () => {
    const result = createCareRecipientSchema.safeParse({
      name: 'a'.repeat(101),
      relationship: 'spouse',
      diagnosisStage: 'middle',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid diagnosis stage', () => {
    const result = createCareRecipientSchema.safeParse({
      name: 'Robert Doe',
      relationship: 'spouse',
      diagnosisStage: 'terminal',
    })
    expect(result.success).toBe(false)
  })

  it('rejects diagnosisDetails exceeding 1000 chars', () => {
    const result = createCareRecipientSchema.safeParse({
      name: 'Robert Doe',
      relationship: 'spouse',
      diagnosisStage: 'late',
      diagnosisDetails: 'a'.repeat(1001),
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid date format for dateOfBirth', () => {
    const result = createCareRecipientSchema.safeParse({
      name: 'Robert Doe',
      relationship: 'spouse',
      diagnosisStage: 'middle',
      dateOfBirth: 'March 15, 1950',
    })
    expect(result.success).toBe(false)
  })

  it('accepts all valid diagnosis stage enum values', () => {
    for (const diagnosisStage of DIAGNOSIS_STAGES) {
      const result = createCareRecipientSchema.safeParse({
        name: 'Robert Doe',
        relationship: 'spouse',
        diagnosisStage,
      })
      expect(result.success, `Expected '${diagnosisStage}' to be valid`).toBe(true)
    }
  })

  it('trims whitespace from name', () => {
    const result = createCareRecipientSchema.safeParse({
      name: '  Robert Doe  ',
      relationship: 'spouse',
      diagnosisStage: 'middle',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('Robert Doe')
    }
  })

  it('rejects whitespace-only name after trim', () => {
    const result = createCareRecipientSchema.safeParse({
      name: '   ',
      relationship: 'spouse',
      diagnosisStage: 'middle',
    })
    expect(result.success).toBe(false)
  })

  it('rejects dateOfBirth before 1900', () => {
    const result = createCareRecipientSchema.safeParse({
      name: 'Robert Doe',
      relationship: 'spouse',
      diagnosisStage: 'middle',
      dateOfBirth: '1899-12-31',
    })
    expect(result.success).toBe(false)
  })

  it('rejects dateOfBirth for someone under 18', () => {
    const underageYear = new Date().getFullYear() - 17
    const result = createCareRecipientSchema.safeParse({
      name: 'Robert Doe',
      relationship: 'spouse',
      diagnosisStage: 'middle',
      dateOfBirth: `${underageYear}-01-01`,
    })
    expect(result.success).toBe(false)
  })
})

describe('updateCareRecipientSchema', () => {
  it('accepts partial updates', () => {
    const result = updateCareRecipientSchema.safeParse({
      diagnosisStage: 'late',
    })
    expect(result.success).toBe(true)
  })

  it('accepts empty object (no updates)', () => {
    const result = updateCareRecipientSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('still validates field constraints on partial', () => {
    const result = updateCareRecipientSchema.safeParse({
      name: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid relationship on partial update', () => {
    const result = updateCareRecipientSchema.safeParse({
      relationship: 'Father',
    })
    expect(result.success).toBe(false)
  })
})
