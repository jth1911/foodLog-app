import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ENTRIES_KEY, GOALS_KEY, localStorageStore } from './foodLogRepo'
import { DEFAULT_GOALS, type FoodEntry, type Goals } from './nutrition'

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

describe('localStorageStore', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => localStorage.clear())

  it('returns null when nothing has been stored yet', () => {
    expect(localStorageStore.loadEntries()).toBeNull()
    expect(localStorageStore.loadGoals()).toBeNull()
  })

  it('round-trips entries through localStorage', () => {
    const entries = [baseEntry, { ...baseEntry, id: 'def', servingSize: '1 large', quantity: 2 }]
    localStorageStore.saveEntries(entries)
    expect(localStorageStore.loadEntries()).toEqual(entries)
  })

  it('round-trips goals through localStorage', () => {
    const goals: Goals = { ...DEFAULT_GOALS, protein: 200 }
    localStorageStore.saveGoals(goals)
    expect(localStorageStore.loadGoals()).toEqual(goals)
  })

  it('persists an empty list distinctly from "nothing stored"', () => {
    localStorageStore.saveEntries([])
    expect(localStorageStore.loadEntries()).toEqual([])
  })

  it('writes under stable, versioned keys', () => {
    localStorageStore.saveEntries([baseEntry])
    localStorageStore.saveGoals(DEFAULT_GOALS)
    expect(localStorage.getItem(ENTRIES_KEY)).toContain('Grilled chicken salad')
    expect(localStorage.getItem(GOALS_KEY)).not.toBeNull()
  })

  it('returns null (rather than throwing) on corrupt JSON', () => {
    localStorage.setItem(ENTRIES_KEY, '{not valid json')
    localStorage.setItem(GOALS_KEY, 'also broken')
    expect(localStorageStore.loadEntries()).toBeNull()
    expect(localStorageStore.loadGoals()).toBeNull()
  })

  it('rejects valid JSON of the wrong shape for entries (non-array → null)', () => {
    // Tampered/legacy values that parse fine but would crash entries.filter(...).
    for (const bad of ['{}', '42', '"a string"', 'null', 'true']) {
      localStorage.setItem(ENTRIES_KEY, bad)
      expect(localStorageStore.loadEntries()).toBeNull()
    }
  })

  it('rejects valid JSON of the wrong shape for goals', () => {
    // Non-object, array, and objects missing/with non-numeric macros all fail.
    localStorage.setItem(GOALS_KEY, '[]')
    expect(localStorageStore.loadGoals()).toBeNull()
    localStorage.setItem(GOALS_KEY, JSON.stringify({ calories: 2000 }))
    expect(localStorageStore.loadGoals()).toBeNull()
    localStorage.setItem(GOALS_KEY, JSON.stringify({ ...DEFAULT_GOALS, protein: 'lots' }))
    expect(localStorageStore.loadGoals()).toBeNull()
  })

  it('accepts a well-formed goals object', () => {
    localStorage.setItem(GOALS_KEY, JSON.stringify(DEFAULT_GOALS))
    expect(localStorageStore.loadGoals()).toEqual(DEFAULT_GOALS)
  })
})
