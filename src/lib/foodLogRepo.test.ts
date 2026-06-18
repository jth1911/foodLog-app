import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ENTRIES_KEY, FOODS_KEY, GOALS_KEY, GOAL_HISTORY_KEY, localStorageStore } from './foodLogRepo'
import { DEFAULT_GOALS, type FoodEntry, type GoalChange } from './nutrition'
import { type UserFoodReference } from './foods'

const baseEntry: FoodEntry = {
  id: 'abc',
  date: '2026-05-01',
  week: 18,
  weekday: 'Friday',
  mealType: 'Lunch',
  description: 'Grilled chicken salad',
  fat: 18,
  carbs: 20,
  protein: 43,
  fiber: 7,
  calories: 430,
}

const baseHistory: GoalChange[] = [
  { effectiveDate: '2026-01-01', goals: { ...DEFAULT_GOALS, protein: 120 } },
  { effectiveDate: '2026-05-01', goals: { ...DEFAULT_GOALS, protein: 130 } },
]

describe('localStorageStore', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => localStorage.clear())

  it('returns null when nothing has been stored yet', () => {
    expect(localStorageStore.loadEntries()).toBeNull()
    expect(localStorageStore.loadGoalHistory()).toBeNull()
    expect(localStorageStore.loadLegacyGoals()).toBeNull()
  })

  it('round-trips entries through localStorage', () => {
    const entries = [baseEntry, { ...baseEntry, id: 'def', servingSize: '1 large', quantity: 2 }]
    localStorageStore.saveEntries(entries)
    expect(localStorageStore.loadEntries()).toEqual(entries)
  })

  it('round-trips the goal history through localStorage', () => {
    localStorageStore.saveGoalHistory(baseHistory)
    expect(localStorageStore.loadGoalHistory()).toEqual(baseHistory)
  })

  it('persists an empty list distinctly from "nothing stored"', () => {
    localStorageStore.saveEntries([])
    expect(localStorageStore.loadEntries()).toEqual([])
  })

  it('writes under stable, versioned keys', () => {
    localStorageStore.saveEntries([baseEntry])
    localStorageStore.saveGoalHistory(baseHistory)
    expect(localStorage.getItem(ENTRIES_KEY)).toContain('Grilled chicken salad')
    expect(localStorage.getItem(GOAL_HISTORY_KEY)).not.toBeNull()
  })

  it('returns null (rather than throwing) on corrupt JSON', () => {
    localStorage.setItem(ENTRIES_KEY, '{not valid json')
    localStorage.setItem(GOAL_HISTORY_KEY, 'also broken')
    expect(localStorageStore.loadEntries()).toBeNull()
    expect(localStorageStore.loadGoalHistory()).toBeNull()
  })

  it('rejects valid JSON of the wrong shape for entries (non-array → null)', () => {
    // Tampered/legacy values that parse fine but would crash entries.filter(...).
    for (const bad of ['{}', '42', '"a string"', 'null', 'true']) {
      localStorage.setItem(ENTRIES_KEY, bad)
      expect(localStorageStore.loadEntries()).toBeNull()
    }
  })

  it('rejects valid JSON of the wrong shape for the goal history', () => {
    // Non-array, and arrays whose entries miss effectiveDate or carry bad goals.
    localStorage.setItem(GOAL_HISTORY_KEY, JSON.stringify({}))
    expect(localStorageStore.loadGoalHistory()).toBeNull()
    localStorage.setItem(GOAL_HISTORY_KEY, JSON.stringify([{ goals: DEFAULT_GOALS }]))
    expect(localStorageStore.loadGoalHistory()).toBeNull()
    localStorage.setItem(
      GOAL_HISTORY_KEY,
      JSON.stringify([{ effectiveDate: '2026-01-01', goals: { calories: 2000 } }]),
    )
    expect(localStorageStore.loadGoalHistory()).toBeNull()
  })

  it('accepts a well-formed goal history', () => {
    localStorage.setItem(GOAL_HISTORY_KEY, JSON.stringify(baseHistory))
    expect(localStorageStore.loadGoalHistory()).toEqual(baseHistory)
  })

  const baseFoods: Record<string, UserFoodReference[]> = {
    'Dairy/Eggs': [
      { id: 'f1', food: 'Egg', serving_size: '1 large', protein: 6, carbs: 1, calories: 70 },
    ],
    Custom: [
      { id: 'f2', food: 'Protein bar', serving_size: '1 bar', protein: 20, carbs: 25, calories: 210, fat: 7, fiber: 3 },
    ],
  }

  it('round-trips user foods through localStorage', () => {
    localStorageStore.saveFoods(baseFoods)
    expect(localStorageStore.loadFoods()).toEqual(baseFoods)
    expect(localStorage.getItem(FOODS_KEY)).toContain('Protein bar')
  })

  it('persists an empty foods record distinctly from "nothing stored"', () => {
    expect(localStorageStore.loadFoods()).toBeNull()
    localStorageStore.saveFoods({})
    expect(localStorageStore.loadFoods()).toEqual({})
  })

  it('rejects wrong-shaped foods (non-object, non-array values, bad macros)', () => {
    // Top-level must be a plain object of category → foods.
    for (const bad of ['[]', '42', 'null', '"x"']) {
      localStorage.setItem(FOODS_KEY, bad)
      expect(localStorageStore.loadFoods()).toBeNull()
    }
    // A category whose value isn't an array.
    localStorage.setItem(FOODS_KEY, JSON.stringify({ Dairy: {} }))
    expect(localStorageStore.loadFoods()).toBeNull()
    // A food missing a required numeric macro (protein) falls back.
    localStorage.setItem(
      FOODS_KEY,
      JSON.stringify({ Dairy: [{ id: 'f1', food: 'Egg', serving_size: '1 large', carbs: 1, calories: 70 }] }),
    )
    expect(localStorageStore.loadFoods()).toBeNull()
  })

  it('reads a legacy single goal for migration', () => {
    localStorage.setItem(GOALS_KEY, JSON.stringify(DEFAULT_GOALS))
    expect(localStorageStore.loadLegacyGoals()).toEqual(DEFAULT_GOALS)
    // A malformed legacy value is ignored rather than crashing migration.
    localStorage.setItem(GOALS_KEY, JSON.stringify({ protein: 'lots' }))
    expect(localStorageStore.loadLegacyGoals()).toBeNull()
  })
})
