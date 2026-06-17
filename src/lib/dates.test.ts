import { describe, it, expect, vi, afterEach } from 'vitest'
import { addDays, weekdayOf, isoWeekOf, todayIso, isoToDate, dateToIso } from './dates'

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

describe('weekdayOf', () => {
  it('matches the seed entries (2026-06-17 is a Wednesday)', () => {
    expect(weekdayOf('2026-06-17')).toBe('Wednesday')
  })

  it('returns the right weekday across a week', () => {
    expect(weekdayOf('2026-06-15')).toBe('Monday')
    expect(weekdayOf('2026-06-21')).toBe('Sunday')
  })

  it('is timezone-safe at the start of a day', () => {
    // A date that would roll back to the previous day under a negative offset.
    expect(weekdayOf('2026-01-01')).toBe('Thursday')
  })
})

describe('isoWeekOf', () => {
  it('matches the seed entries (2026-06-17 is week 25)', () => {
    expect(isoWeekOf('2026-06-17')).toBe(25)
  })

  it('puts 2026-01-01 (a Thursday) in week 1', () => {
    expect(isoWeekOf('2026-01-01')).toBe(1)
  })

  it('assigns early-January days to the previous ISO year', () => {
    // 2027-01-01 is a Friday → belongs to 2026 week 53.
    expect(isoWeekOf('2027-01-01')).toBe(53)
  })

  it('assigns late-December days to the next ISO year', () => {
    // 2024-12-30 is a Monday → belongs to 2025 week 1.
    expect(isoWeekOf('2024-12-30')).toBe(1)
  })
})

describe('todayIso', () => {
  afterEach(() => vi.useRealTimers())

  it("returns the local calendar day as YYYY-MM-DD", () => {
    vi.useFakeTimers()
    // Midday local time, well away from any UTC day boundary.
    vi.setSystemTime(new Date(2026, 2, 10, 12, 0, 0))
    expect(todayIso()).toBe('2026-03-10')
  })

  it('reflects the clock when it advances past midnight', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 11, 31, 23, 59, 59))
    expect(todayIso()).toBe('2026-12-31')
    vi.setSystemTime(new Date(2027, 0, 1, 0, 0, 1))
    expect(todayIso()).toBe('2027-01-01')
  })
})

describe('isoToDate / dateToIso', () => {
  it('isoToDate builds a local-midnight Date for the given day', () => {
    const d = isoToDate('2026-05-01')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(4) // May (0-indexed)
    expect(d.getDate()).toBe(1)
    expect(d.getHours()).toBe(0)
  })

  it('dateToIso formats local date parts, zero-padded', () => {
    expect(dateToIso(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(dateToIso(new Date(2026, 11, 31))).toBe('2026-12-31')
  })

  it('round-trips ISO → Date → ISO without timezone drift', () => {
    for (const iso of ['2026-01-01', '2026-05-01', '2026-06-17', '2026-12-31']) {
      expect(dateToIso(isoToDate(iso))).toBe(iso)
    }
  })
})
