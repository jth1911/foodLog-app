import { describe, it, expect } from 'vitest'
import {
  weekWindow,
  dailyMacroSeries,
  proteinStreak,
  fiberSeries,
  mealCalorieBreakdown,
} from './weekly'
import { GOALS_EPOCH, type FoodEntry, type GoalChange } from './nutrition'
import { isoWeekOf, weekdayOf } from './dates'

// Build a FoodEntry with sensible defaults, overriding only what a test cares
// about. Week/weekday are derived so entries stay internally consistent.
function entry(partial: Partial<FoodEntry> & { date: string }): FoodEntry {
  return {
    id: crypto.randomUUID(),
    week: isoWeekOf(partial.date),
    weekday: weekdayOf(partial.date),
    mealType: 'Lunch',
    description: 'Test food',
    fat: 0,
    carbs: 0,
    protein: 0,
    fiber: 0,
    calories: 0,
    ...partial,
  }
}

// A single goal history covering all time with the given protein/fiber targets.
function goalsWith(protein: number, fiber: number): GoalChange[] {
  return [
    {
      effectiveDate: GOALS_EPOCH,
      goals: { calories: 2000, protein, fat: 75, carbs: 130, fiber },
    },
  ]
}

describe('weekWindow', () => {
  it('returns 7 ascending ISO dates ending at the end date by default', () => {
    expect(weekWindow('2026-06-17')).toEqual([
      '2026-06-11',
      '2026-06-12',
      '2026-06-13',
      '2026-06-14',
      '2026-06-15',
      '2026-06-16',
      '2026-06-17',
    ])
  })

  it('honours a custom window length', () => {
    expect(weekWindow('2026-06-17', 3)).toEqual(['2026-06-15', '2026-06-16', '2026-06-17'])
  })

  it('normalises across a month boundary', () => {
    expect(weekWindow('2026-07-02', 4)).toEqual([
      '2026-06-29',
      '2026-06-30',
      '2026-07-01',
      '2026-07-02',
    ])
  })
})

describe('dailyMacroSeries', () => {
  const dates = weekWindow('2026-06-17')

  it('sums each macro per day and labels the weekday', () => {
    const entries = [
      entry({ date: '2026-06-17', protein: 30, carbs: 20, fat: 10, fiber: 5, calories: 300 }),
      entry({ date: '2026-06-17', protein: 20, carbs: 10, fat: 5, fiber: 3, calories: 200 }),
      entry({ date: '2026-06-15', protein: 40, carbs: 50, fat: 12, fiber: 8, calories: 500 }),
    ]
    const series = dailyMacroSeries(entries, dates)
    expect(series).toHaveLength(7)
    const last = series[series.length - 1]
    expect(last).toMatchObject({
      date: '2026-06-17',
      weekday: 'Wednesday',
      protein: 50,
      carbs: 30,
      fat: 15,
      fiber: 8,
      calories: 500,
    })
    expect(series.find((d) => d.date === '2026-06-15')).toMatchObject({ protein: 40, calories: 500 })
  })

  it('reports zeros for days with no entries', () => {
    const series = dailyMacroSeries([], dates)
    expect(series.every((d) => d.protein === 0 && d.calories === 0)).toBe(true)
  })

  it('ignores entries outside the window', () => {
    const entries = [entry({ date: '2026-06-01', protein: 99, calories: 999 })]
    const series = dailyMacroSeries(entries, dates)
    expect(series.every((d) => d.protein === 0)).toBe(true)
  })
})

describe('proteinStreak', () => {
  const dates = weekWindow('2026-06-17')

  it('counts days that meet or exceed the protein goal', () => {
    const goals = goalsWith(150, 30)
    const entries = [
      entry({ date: '2026-06-11', protein: 150 }), // exactly meets → counts
      entry({ date: '2026-06-12', protein: 160 }),
      entry({ date: '2026-06-13', protein: 100 }), // misses
      entry({ date: '2026-06-15', protein: 200 }),
    ]
    const result = proteinStreak(entries, goals, dates)
    expect(result.daysHit).toBe(3)
    expect(result.total).toBe(7)
  })

  it('reports the longest consecutive run of hit days', () => {
    const goals = goalsWith(150, 30)
    const entries = [
      entry({ date: '2026-06-11', protein: 150 }),
      entry({ date: '2026-06-12', protein: 150 }),
      entry({ date: '2026-06-13', protein: 0 }), // breaks the run
      entry({ date: '2026-06-14', protein: 150 }),
      entry({ date: '2026-06-15', protein: 150 }),
      entry({ date: '2026-06-16', protein: 150 }),
      entry({ date: '2026-06-17', protein: 0 }),
    ]
    const result = proteinStreak(entries, goals, dates)
    expect(result.daysHit).toBe(5)
    expect(result.longestStreak).toBe(3)
  })

  it('is 0/7 with no entries', () => {
    const result = proteinStreak([], goalsWith(150, 30), dates)
    expect(result).toMatchObject({ daysHit: 0, total: 7, longestStreak: 0 })
  })

  it('judges each day against the goal in effect on that day', () => {
    // Goal rises from 100 to 200 effective 2026-06-15; a 150g day passes before
    // the change and fails on/after it.
    const goals: GoalChange[] = [
      { effectiveDate: GOALS_EPOCH, goals: { calories: 2000, protein: 100, fat: 75, carbs: 130, fiber: 30 } },
      { effectiveDate: '2026-06-15', goals: { calories: 2000, protein: 200, fat: 75, carbs: 130, fiber: 30 } },
    ]
    const entries = [
      entry({ date: '2026-06-14', protein: 150 }), // ≥100 → hit
      entry({ date: '2026-06-15', protein: 150 }), // <200 → miss
    ]
    expect(proteinStreak(entries, goals, dates).daysHit).toBe(1)
  })
})

describe('fiberSeries', () => {
  const dates = weekWindow('2026-06-17')

  it('pairs each day fiber total with that day fiber goal', () => {
    const goals = goalsWith(150, 30)
    const entries = [
      entry({ date: '2026-06-17', fiber: 12 }),
      entry({ date: '2026-06-17', fiber: 8 }),
    ]
    const series = fiberSeries(entries, goals, dates)
    expect(series).toHaveLength(7)
    expect(series[series.length - 1]).toMatchObject({
      date: '2026-06-17',
      weekday: 'Wednesday',
      fiber: 20,
      goal: 30,
    })
  })
})

describe('mealCalorieBreakdown', () => {
  const dates = weekWindow('2026-06-17')

  it('sums calories per meal across the window with percentages', () => {
    const entries = [
      entry({ date: '2026-06-17', mealType: 'Breakfast', calories: 300 }),
      entry({ date: '2026-06-16', mealType: 'Lunch', calories: 500 }),
      entry({ date: '2026-06-15', mealType: 'Lunch', calories: 100 }),
      entry({ date: '2026-06-14', mealType: 'Dinner', calories: 100 }),
    ]
    const breakdown = mealCalorieBreakdown(entries, dates)
    const byMeal = Object.fromEntries(breakdown.map((b) => [b.mealType, b]))
    expect(byMeal.Lunch.calories).toBe(600)
    expect(byMeal.Lunch.share).toBe(60) // 600 / 1000
    expect(byMeal.Breakfast.share).toBe(30)
    expect(byMeal.Snacks.calories).toBe(0)
  })

  it('returns all meals at 0% when there are no calories', () => {
    const breakdown = mealCalorieBreakdown([], dates)
    expect(breakdown).toHaveLength(4)
    expect(breakdown.every((b) => b.calories === 0 && b.share === 0)).toBe(true)
  })
})
