import { describe, it, expect } from 'vitest'
import { containsPhi } from '../phi-detector.js'

describe('containsPhi', () => {
  // SSN patterns
  it('detects SSN format XXX-XX-XXXX', () => {
    expect(containsPhi('My SSN is 123-45-6789')).toBe(true)
  })

  it('detects SSN in middle of text', () => {
    expect(containsPhi('Please check 987-65-4321 for records')).toBe(true)
  })

  it('does NOT false-positive on phone numbers like 1-800-555-1234', () => {
    expect(containsPhi('Call 1-800-555-1234 for support')).toBe(false)
  })

  it('does NOT false-positive on general numbers', () => {
    expect(containsPhi('We do exercises at 10:30 and lunch at 12:00')).toBe(false)
  })

  it('does NOT flag normal caregiving content', () => {
    expect(containsPhi('I found a great morning routine for my loved one')).toBe(false)
  })

  // Email + full name patterns
  it('detects email with preceding full name', () => {
    expect(containsPhi('Contact Margaret Smith at margaret@gmail.com')).toBe(true)
  })

  it('detects email with following full name', () => {
    expect(containsPhi('Send to john@hospital.org for John Doe')).toBe(true)
  })

  it('does NOT flag email without a nearby full name', () => {
    expect(containsPhi('email us at support@example.com')).toBe(false)
  })

  // MRN patterns
  it('detects "MRN" followed by digits', () => {
    expect(containsPhi('Her MRN is 12345678')).toBe(true)
  })

  it('detects "MRN:" followed by digits', () => {
    expect(containsPhi('Check MRN: 99887766')).toBe(true)
  })

  it('detects "MRN#" followed by digits', () => {
    expect(containsPhi('MRN#55667788 in the system')).toBe(true)
  })

  it('detects "medical record number" followed by digits', () => {
    expect(containsPhi('The medical record number is 9876543')).toBe(true)
  })

  it('does NOT flag "MRN" without sufficient digits', () => {
    expect(containsPhi('The MRN team met today')).toBe(false)
  })
})
