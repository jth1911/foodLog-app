import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ENTRIES_KEY, GOALS_KEY, GOAL_HISTORY_KEY, localStorageStore } from './foodLogRepo'
import { DEFAULT_GOALS, type FoodEntry, type GoalChange } from './nutrition'

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

  it('reads a legacy single goal for migration', () => {
    localStorage.setItem(GOALS_KEY, JSON.stringify(DEFAULT_GOALS))
    expect(localStorageStore.loadLegacyGoals()).toEqual(DEFAULT_GOALS)
    // A malformed legacy value is ignored rather than crashing migration.
    localStorage.setItem(GOALS_KEY, JSON.stringify({ protein: 'lots' }))
    expect(localStorageStore.loadLegacyGoals()).toBeNull()
  })
})
