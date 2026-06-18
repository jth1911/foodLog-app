import { describe, it, expect } from 'vitest'
import {
  weightForDate,
  previousWeight,
  movingAverage,
  weightSeries,
  type WeightEntry,
} from './weight'
import { weekdayOf } from './dates'

const history: WeightEntry[] = [
  { date: '2026-06-01', lb: 180 },
  { date: '2026-06-04', lb: 179 },
  { date: '2026-06-07', lb: 178 },
]

describe('weightForDate', () => {
  it('returns the recorded weight on a logged day', () => {
    expect(weightForDate(history, '2026-06-04')).toBe(179)
  })

  it('returns null on a day with no weigh-in (no carry-forward)', () => {
    expect(weightForDate(history, '2026-06-02')).toBeNull()
    expect(weightForDate(history, '2026-06-08')).toBeNull()
  })

  it('returns null for empty history', () => {
    expect(weightForDate([], '2026-06-01')).toBeNull()
  })
})

describe('previousWeight', () => {
  it('returns the most recent weight strictly before the date', () => {
    expect(previousWeight(history, '2026-06-04')).toBe(180) // not 06-04 itself
    expect(previousWeight(history, '2026-06-06')).toBe(179) // last before 06-06
  })

  it('reaches back across multi-day gaps to the last weigh-in', () => {
    expect(previousWeight(history, '2026-06-20')).toBe(178)
  })

  it('returns null when there is no earlier weigh-in', () => {
    expect(previousWeight(history, '2026-06-01')).toBeNull()
    expect(previousWeight(history, '2026-05-31')).toBeNull()
  })

  it('handles an unsorted history defensively', () => {
    const unsorted: WeightEntry[] = [
      { date: '2026-06-07', lb: 178 },
      { date: '2026-06-01', lb: 180 },
    ]
    expect(previousWeight(unsorted, '2026-06-05')).toBe(180)
  })
})

describe('movingAverage', () => {
  it('averages the trailing window', () => {
    expect(movingAverage([2, 4, 6], 3)).toEqual([2, 3, 4])
  })

  it('uses partial windows at the start', () => {
    expect(movingAverage([10, 20], 7)).toEqual([10, 15])
  })

  it('skips null holes and yields null when the window is all-null', () => {
    expect(movingAverage([null, null, 10, 20], 2)).toEqual([null, null, 10, 15])
  })

  it('rounds to one decimal place', () => {
    expect(movingAverage([1, 2], 2)).toEqual([1, 1.5])
    expect(movingAverage([1, 1, 2], 3)).toEqual([1, 1, 1.3])
  })
})

describe('weightSeries', () => {
  it('plots only recorded days, leaving gaps (null) for unlogged ones', () => {
    const dates = ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04']
    const series = weightSeries(history, dates)
    expect(series.map((p) => p.lb)).toEqual([180, null, null, 179])
  })

  it('pairs each recorded day with weekday and a trailing-average trend', () => {
    const dates = ['2026-06-01', '2026-06-04']
    const series = weightSeries(history, dates)
    expect(series[0]).toEqual({
      date: '2026-06-01',
      weekday: weekdayOf('2026-06-01'),
      lb: 180,
      trend: 180,
    })
    // Trend averages the recorded values seen so far (gaps skipped): (180+179)/2.
    expect(series[1]).toMatchObject({ date: '2026-06-04', lb: 179, trend: 179.5 })
  })

  it('is all-null when nothing is logged in the window', () => {
    const series = weightSeries([], ['2026-06-01', '2026-06-02'])
    expect(series.every((p) => p.lb === null && p.trend === null)).toBe(true)
  })
})
