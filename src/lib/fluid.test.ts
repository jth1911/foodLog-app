import { describe, it, expect } from 'vitest'
import {
  DRINK_TYPES,
  fluidTotalsForDate,
  fluidGoalStatus,
  fluidSeries,
  type FluidEntry,
} from './fluid'
import { weekdayOf } from './dates'

const fluids: FluidEntry[] = [
  {
    id: '1',
    date: '2026-06-17',
    week: 25,
    weekday: 'Wednesday',
    drinkType: 'Water',
    oz: 16,
    calories: 0,
  },
  {
    id: '2',
    date: '2026-06-17',
    week: 25,
    weekday: 'Wednesday',
    drinkType: 'Juice',
    oz: 8,
    calories: 110,
  },
  {
    id: '3',
    date: '2026-06-18',
    week: 25,
    weekday: 'Thursday',
    drinkType: 'Coffee',
    oz: 12,
    calories: 5,
  },
]

describe('DRINK_TYPES', () => {
  it('is a fixed list led by Water and ending in Other', () => {
    expect(DRINK_TYPES[0]).toBe('Water')
    expect(DRINK_TYPES[DRINK_TYPES.length - 1]).toBe('Other')
    expect(DRINK_TYPES).toContain('Coffee')
    expect(DRINK_TYPES).toContain('Juice')
  })
})

describe('fluidTotalsForDate', () => {
  it('sums oz and calories across the day’s drinks', () => {
    expect(fluidTotalsForDate(fluids, '2026-06-17')).toEqual({ oz: 24, calories: 110 })
  })

  it('only counts the requested day', () => {
    expect(fluidTotalsForDate(fluids, '2026-06-18')).toEqual({ oz: 12, calories: 5 })
  })

  it('is all-zero for a day with no drinks', () => {
    expect(fluidTotalsForDate(fluids, '2026-06-19')).toEqual({ oz: 0, calories: 0 })
    expect(fluidTotalsForDate([], '2026-06-17')).toEqual({ oz: 0, calories: 0 })
  })
})

describe('fluidGoalStatus', () => {
  it('meets the goal when oz reaches or exceeds it', () => {
    expect(fluidGoalStatus(64, 64)).toBe('met')
    expect(fluidGoalStatus(80, 64)).toBe('met')
  })

  it('is unmet when below the goal', () => {
    expect(fluidGoalStatus(40, 64)).toBe('unmet')
  })
})

describe('fluidSeries', () => {
  it('produces one row per date with that day’s oz total', () => {
    const dates = ['2026-06-16', '2026-06-17', '2026-06-18']
    const series = fluidSeries(fluids, dates)
    expect(series).toEqual([
      { date: '2026-06-16', weekday: weekdayOf('2026-06-16'), oz: 0 },
      { date: '2026-06-17', weekday: weekdayOf('2026-06-17'), oz: 24 },
      { date: '2026-06-18', weekday: weekdayOf('2026-06-18'), oz: 12 },
    ])
  })
})
