import { describe, it, expect } from 'vitest'
import { calorieHeatmap, topFoods, monthlyMacroRatio, CALORIE_BAND } from './monthly'
import { GOALS_EPOCH, type FoodEntry, type GoalChange } from './nutrition'
import { monthDays, isoWeekOf, weekdayOf } from './dates'

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

// A single goal history covering all time with the given calorie target.
function goalsWith(calories: number): GoalChange[] {
  return [
    {
      effectiveDate: GOALS_EPOCH,
      goals: { calories, protein: 120, fat: 75, carbs: 130, fiber: 30 },
    },
  ]
}

const JUNE = monthDays('2026-06-01')

describe('calorieHeatmap', () => {
  it('returns one row per date with empty status for unlogged days', () => {
    const result = calorieHeatmap([], goalsWith(2000), JUNE)
    expect(result).toHaveLength(30)
    expect(result.every((d) => d.status === 'empty')).toBe(true)
    expect(result.every((d) => d.entryCount === 0)).toBe(true)
  })

  it('classifies under / in-range / over against the ±band', () => {
    // goal 2000, band ±10% → floor 1800, ceiling 2200.
    const entries = [
      entry({ date: '2026-06-01', calories: 1500 }), // under
      entry({ date: '2026-06-02', calories: 2000 }), // in-range (midpoint)
      entry({ date: '2026-06-03', calories: 2500 }), // over
    ]
    const result = calorieHeatmap(entries, goalsWith(2000), JUNE)
    const byDate = Object.fromEntries(result.map((d) => [d.date, d.status]))
    expect(byDate['2026-06-01']).toBe('under')
    expect(byDate['2026-06-02']).toBe('in-range')
    expect(byDate['2026-06-03']).toBe('over')
  })

  it('treats the floor and ceiling as inclusive of in-range', () => {
    const floor = 2000 * (1 - CALORIE_BAND) // 1800
    const ceiling = 2000 * (1 + CALORIE_BAND) // 2200
    const entries = [
      entry({ date: '2026-06-10', calories: floor }),
      entry({ date: '2026-06-11', calories: ceiling }),
    ]
    const result = calorieHeatmap(entries, goalsWith(2000), JUNE)
    const byDate = Object.fromEntries(result.map((d) => [d.date, d.status]))
    expect(byDate['2026-06-10']).toBe('in-range')
    expect(byDate['2026-06-11']).toBe('in-range')
  })

  it('reads as logged (not empty) when entries exist but total zero calories', () => {
    const entries = [entry({ date: '2026-06-05', calories: 0 })]
    const result = calorieHeatmap(entries, goalsWith(2000), JUNE)
    const day = result.find((d) => d.date === '2026-06-05')!
    expect(day.entryCount).toBe(1)
    expect(day.status).toBe('under') // logged, far below the floor
  })

  it('applies the goal in effect on each day when goals change mid-month', () => {
    const goalHistory: GoalChange[] = [
      { effectiveDate: GOALS_EPOCH, goals: { calories: 2000, protein: 120, fat: 75, carbs: 130, fiber: 30 } },
      { effectiveDate: '2026-06-15', goals: { calories: 3000, protein: 120, fat: 75, carbs: 130, fiber: 30 } },
    ]
    const entries = [
      entry({ date: '2026-06-10', calories: 2500 }), // vs 2000 goal → over
      entry({ date: '2026-06-20', calories: 2500 }), // vs 3000 goal → under
    ]
    const result = calorieHeatmap(entries, goalHistory, JUNE)
    const byDate = Object.fromEntries(result.map((d) => [d.date, d.status]))
    expect(byDate['2026-06-10']).toBe('over')
    expect(byDate['2026-06-20']).toBe('under')
  })
})

describe('topFoods', () => {
  it('ranks descriptions by entry count, descending', () => {
    const entries = [
      entry({ date: '2026-06-01', description: 'Eggs' }),
      entry({ date: '2026-06-02', description: 'Eggs' }),
      entry({ date: '2026-06-03', description: 'Eggs' }),
      entry({ date: '2026-06-01', description: 'Oats' }),
      entry({ date: '2026-06-02', description: 'Oats' }),
      entry({ date: '2026-06-01', description: 'Banana' }),
    ]
    const result = topFoods(entries, JUNE)
    expect(result).toEqual([
      { description: 'Eggs', count: 3 },
      { description: 'Oats', count: 2 },
      { description: 'Banana', count: 1 },
    ])
  })

  it('counts case-insensitively and keeps the first-seen casing', () => {
    const entries = [
      entry({ date: '2026-06-01', description: 'Greek Yogurt' }),
      entry({ date: '2026-06-02', description: 'greek yogurt' }),
      entry({ date: '2026-06-03', description: '  GREEK YOGURT ' }),
    ]
    const result = topFoods(entries, JUNE)
    expect(result).toEqual([{ description: 'Greek Yogurt', count: 3 }])
  })

  it('aggregates across all meal types', () => {
    const entries = [
      entry({ date: '2026-06-01', description: 'Almonds', mealType: 'Breakfast' }),
      entry({ date: '2026-06-01', description: 'Almonds', mealType: 'Snacks' }),
      entry({ date: '2026-06-02', description: 'Almonds', mealType: 'Dinner' }),
    ]
    expect(topFoods(entries, JUNE)).toEqual([{ description: 'Almonds', count: 3 }])
  })

  it('limits to the top 5 by default', () => {
    const entries = ['a', 'b', 'c', 'd', 'e', 'f'].map((d, i) =>
      // Give each a distinct count (a=6 … f=1) so the ranking is unambiguous.
      Array.from({ length: 6 - i }, () => entry({ date: '2026-06-01', description: d })),
    ).flat()
    const result = topFoods(entries, JUNE)
    expect(result.map((f) => f.description)).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('ignores entries outside the window', () => {
    const entries = [
      entry({ date: '2026-05-31', description: 'Eggs' }),
      entry({ date: '2026-07-01', description: 'Eggs' }),
      entry({ date: '2026-06-15', description: 'Eggs' }),
    ]
    expect(topFoods(entries, JUNE)).toEqual([{ description: 'Eggs', count: 1 }])
  })

  it('breaks count ties by first-seen order', () => {
    const entries = [
      entry({ date: '2026-06-01', description: 'Banana' }),
      entry({ date: '2026-06-01', description: 'Apple' }),
    ]
    expect(topFoods(entries, JUNE).map((f) => f.description)).toEqual(['Banana', 'Apple'])
  })
})

describe('monthlyMacroRatio', () => {
  it('returns all three macro slices even with no entries', () => {
    const result = monthlyMacroRatio([], JUNE)
    expect(result.map((s) => s.macro)).toEqual(['protein', 'carbs', 'fat'])
    expect(result.every((s) => s.grams === 0 && s.share === 0)).toBe(true)
  })

  it('sums grams and computes whole-percent shares of the macro total', () => {
    const entries = [
      entry({ date: '2026-06-01', protein: 100, carbs: 200, fat: 100 }),
      entry({ date: '2026-06-02', protein: 50, carbs: 50, fat: 0 }),
    ]
    // totals: protein 150, carbs 250, fat 100 → total 500.
    const result = monthlyMacroRatio(entries, JUNE)
    const byMacro = Object.fromEntries(result.map((s) => [s.macro, s]))
    expect(byMacro.protein).toEqual({ macro: 'protein', grams: 150, share: 30 })
    expect(byMacro.carbs).toEqual({ macro: 'carbs', grams: 250, share: 50 })
    expect(byMacro.fat).toEqual({ macro: 'fat', grams: 100, share: 20 })
  })

  it('excludes entries outside the window', () => {
    const entries = [
      entry({ date: '2026-05-31', protein: 999, carbs: 0, fat: 0 }),
      entry({ date: '2026-06-10', protein: 10, carbs: 10, fat: 0 }),
    ]
    const byMacro = Object.fromEntries(monthlyMacroRatio(entries, JUNE).map((s) => [s.macro, s.grams]))
    expect(byMacro.protein).toBe(10)
  })
})
