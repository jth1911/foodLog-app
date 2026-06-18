import { describe, it, expect } from 'vitest'
import {
  resolveWeight,
  materialiseWeights,
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

describe('resolveWeight', () => {
  it('returns null for a date before the first weigh-in', () => {
    expect(resolveWeight(history, '2026-05-31')).toBeNull()
  })

  it('returns the exact value on an entered day', () => {
    expect(resolveWeight(history, '2026-06-04')).toBe(179)
  })

  it('carries forward the previous day on a gap day', () => {
    expect(resolveWeight(history, '2026-06-02')).toBe(180)
    expect(resolveWeight(history, '2026-06-03')).toBe(180)
    expect(resolveWeight(history, '2026-06-05')).toBe(179)
  })

  it('carries the last value forward indefinitely', () => {
    expect(resolveWeight(history, '2026-12-25')).toBe(178)
  })

  it('handles an unsorted history defensively', () => {
    const unsorted: WeightEntry[] = [
      { date: '2026-06-07', lb: 178 },
      { date: '2026-06-01', lb: 180 },
    ]
    expect(resolveWeight(unsorted, '2026-06-03')).toBe(180)
  })

  it('returns null for empty history', () => {
    expect(resolveWeight([], '2026-06-01')).toBeNull()
  })
})

describe('materialiseWeights', () => {
  it('fills every gap day from the first entry up to today', () => {
    const filled = materialiseWeights(
      [
        { date: '2026-06-01', lb: 180 },
        { date: '2026-06-04', lb: 179 },
      ],
      '2026-06-05',
    )
    expect(filled).toEqual([
      { date: '2026-06-01', lb: 180 },
      { date: '2026-06-02', lb: 180 },
      { date: '2026-06-03', lb: 180 },
      { date: '2026-06-04', lb: 179 },
      { date: '2026-06-05', lb: 179 },
    ])
  })

  it('never writes rows past today', () => {
    const filled = materialiseWeights([{ date: '2026-06-01', lb: 180 }], '2026-06-03')
    expect(filled.map((e) => e.date)).toEqual(['2026-06-01', '2026-06-02', '2026-06-03'])
  })

  it('is idempotent on already-materialised input', () => {
    const once = materialiseWeights([{ date: '2026-06-01', lb: 180 }], '2026-06-04')
    expect(materialiseWeights(once, '2026-06-04')).toEqual(once)
  })

  it('returns an empty array for empty history', () => {
    expect(materialiseWeights([], '2026-06-04')).toEqual([])
  })

  it('preserves an explicit future entry without back-filling up to it', () => {
    const filled = materialiseWeights(
      [
        { date: '2026-06-01', lb: 180 },
        { date: '2026-06-10', lb: 175 }, // future relative to today
      ],
      '2026-06-03',
    )
    expect(filled).toEqual([
      { date: '2026-06-01', lb: 180 },
      { date: '2026-06-02', lb: 180 },
      { date: '2026-06-03', lb: 180 },
      { date: '2026-06-10', lb: 175 },
    ])
  })

  it('keeps an entirely-future history untouched (no fill)', () => {
    const future: WeightEntry[] = [{ date: '2026-07-01', lb: 170 }]
    expect(materialiseWeights(future, '2026-06-03')).toEqual(future)
  })

  it('respects a later explicit entry overriding the carried value', () => {
    const filled = materialiseWeights(
      [
        { date: '2026-06-01', lb: 180 },
        { date: '2026-06-03', lb: 182 },
      ],
      '2026-06-04',
    )
    expect(filled).toEqual([
      { date: '2026-06-01', lb: 180 },
      { date: '2026-06-02', lb: 180 },
      { date: '2026-06-03', lb: 182 },
      { date: '2026-06-04', lb: 182 },
    ])
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
  it('produces one carried-forward point per date with weekday + trend', () => {
    const dates = ['2026-06-01', '2026-06-02', '2026-06-03']
    const series = weightSeries([{ date: '2026-06-01', lb: 180 }], dates)
    expect(series).toEqual([
      { date: '2026-06-01', weekday: weekdayOf('2026-06-01'), lb: 180, trend: 180 },
      { date: '2026-06-02', weekday: weekdayOf('2026-06-02'), lb: 180, trend: 180 },
      { date: '2026-06-03', weekday: weekdayOf('2026-06-03'), lb: 180, trend: 180 },
    ])
  })

  it('leaves a leading gap (null) before the first weigh-in', () => {
    const dates = ['2026-05-30', '2026-05-31', '2026-06-01']
    const series = weightSeries([{ date: '2026-06-01', lb: 180 }], dates)
    expect(series[0]).toMatchObject({ lb: null, trend: null })
    expect(series[1]).toMatchObject({ lb: null, trend: null })
    expect(series[2]).toMatchObject({ lb: 180, trend: 180 })
  })
})
