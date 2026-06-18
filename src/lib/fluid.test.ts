import { describe, it, expect } from 'vitest'
import {
  DRINK_TYPES,
  fluidTotalsForDate,
  fluidGoalStatus,
  fluidSeries,
  fluidByTypeSeries,
  activeDrinkTypes,
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

describe('fluidByTypeSeries', () => {
  it('splits each day’s oz total by drink type, zero-filling every type', () => {
    const series = fluidByTypeSeries(fluids, ['2026-06-17', '2026-06-18'])
    expect(series[0]).toMatchObject({ date: '2026-06-17', Water: 16, Juice: 8, Coffee: 0, Tea: 0 })
    expect(series[1]).toMatchObject({ date: '2026-06-18', Coffee: 12, Water: 0, Juice: 0 })
    // Every drink type is present as a key so each line stays continuous.
    for (const type of DRINK_TYPES) expect(series[0]).toHaveProperty(type)
  })

  it('sums multiple drinks of the same type on a day', () => {
    const sameType: FluidEntry[] = [
      { id: 'a', date: '2026-06-17', week: 25, weekday: 'Wednesday', drinkType: 'Coffee', oz: 8, calories: 5 },
      { id: 'b', date: '2026-06-17', week: 25, weekday: 'Wednesday', drinkType: 'Coffee', oz: 12, calories: 5 },
    ]
    expect(fluidByTypeSeries(sameType, ['2026-06-17'])[0].Coffee).toBe(20)
  })
})

describe('activeDrinkTypes', () => {
  it('returns only the types with volume, in DRINK_TYPES order', () => {
    const series = fluidByTypeSeries(fluids, ['2026-06-16', '2026-06-17', '2026-06-18'])
    // fluids use Water, Juice and Coffee — Water leads, Coffee precedes Juice.
    expect(activeDrinkTypes(series)).toEqual(['Water', 'Coffee', 'Juice'])
  })

  it('is empty when nothing is logged', () => {
    expect(activeDrinkTypes(fluidByTypeSeries([], ['2026-06-17']))).toEqual([])
  })
})
