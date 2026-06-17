import { describe, it, expect } from 'vitest'
import {
  totalsForDate,
  goalStatus,
  groupByMeal,
  MACRO_KEYS,
  type FoodEntry,
} from './nutrition'

const make = (over: Partial<FoodEntry>): FoodEntry => ({
  id: over.id ?? 'x',
  date: over.date ?? '2026-06-17',
  week: over.week ?? 25,
  weekday: over.weekday ?? 'Wednesday',
  mealType: over.mealType ?? 'Breakfast',
  description: over.description ?? 'food',
  fat: over.fat ?? 0,
  carbs: over.carbs ?? 0,
  protein: over.protein ?? 0,
  fiber: over.fiber ?? 0,
  calories: over.calories ?? 0,
})

describe('totalsForDate', () => {
  it('sums every macro for entries on the given date', () => {
    const foods = [
      make({ id: '1', date: '2026-06-17', calories: 300, protein: 20, fat: 10, carbs: 30, fiber: 5 }),
      make({ id: '2', date: '2026-06-17', calories: 500, protein: 40, fat: 15, carbs: 50, fiber: 8 }),
    ]
    expect(totalsForDate(foods, '2026-06-17')).toEqual({
      calories: 800,
      protein: 60,
      fat: 25,
      carbs: 80,
      fiber: 13,
    })
  })

  it('ignores entries from other dates', () => {
    const foods = [
      make({ id: '1', date: '2026-06-17', calories: 300, protein: 20 }),
      make({ id: '2', date: '2026-06-16', calories: 999, protein: 99 }),
    ]
    expect(totalsForDate(foods, '2026-06-17')).toMatchObject({ calories: 300, protein: 20 })
  })

  it('returns all-zero totals when nothing matches', () => {
    const totals = totalsForDate([], '2026-06-17')
    for (const k of MACRO_KEYS) expect(totals[k]).toBe(0)
  })
})

describe('goalStatus', () => {
  it('protein (min): met when at or above goal', () => {
    expect(goalStatus('protein', 120, 120)).toBe('met')
    expect(goalStatus('protein', 130, 120)).toBe('met')
    expect(goalStatus('protein', 119, 120)).toBe('unmet')
  })

  it('fat (max): met when at or below goal', () => {
    expect(goalStatus('fat', 75, 75)).toBe('met')
    expect(goalStatus('fat', 60, 75)).toBe('met')
    expect(goalStatus('fat', 76, 75)).toBe('unmet')
  })

  it('carbs (max): met when at or below goal', () => {
    expect(goalStatus('carbs', 130, 130)).toBe('met')
    expect(goalStatus('carbs', 131, 130)).toBe('unmet')
  })

  it('calories (target/budget): met when at or below goal', () => {
    expect(goalStatus('calories', 2000, 2000)).toBe('met')
    expect(goalStatus('calories', 2100, 2000)).toBe('unmet')
  })

  it('fiber (min): met when at or above goal', () => {
    expect(goalStatus('fiber', 30, 30)).toBe('met')
    expect(goalStatus('fiber', 10, 30)).toBe('unmet')
  })
})

describe('groupByMeal', () => {
  it('buckets entries under each meal type and keeps all three keys', () => {
    const foods = [
      make({ id: '1', mealType: 'Breakfast' }),
      make({ id: '2', mealType: 'Dinner' }),
      make({ id: '3', mealType: 'Breakfast' }),
    ]
    const grouped = groupByMeal(foods)
    expect(grouped.Breakfast.map((f) => f.id)).toEqual(['1', '3'])
    expect(grouped.Lunch).toEqual([])
    expect(grouped.Dinner.map((f) => f.id)).toEqual(['2'])
  })
})
