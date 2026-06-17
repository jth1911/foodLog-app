import { describe, it, expect } from 'vitest'
import { addDays } from './dates'

describe('addDays', () => {
  it('moves forward and backward by one day', () => {
    expect(addDays('2026-06-17', 1)).toBe('2026-06-18')
    expect(addDays('2026-06-17', -1)).toBe('2026-06-16')
  })

  it('handles zero as a no-op', () => {
    expect(addDays('2026-06-17', 0)).toBe('2026-06-17')
  })

  it('rolls over month boundaries', () => {
    expect(addDays('2026-06-30', 1)).toBe('2026-07-01')
    expect(addDays('2026-07-01', -1)).toBe('2026-06-30')
  })

  it('rolls over year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('handles leap-year February boundaries', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01')
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01')
  })

  it('moves by multiple days', () => {
    expect(addDays('2026-06-17', 14)).toBe('2026-07-01')
  })
})
