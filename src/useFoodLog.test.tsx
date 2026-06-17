import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useFoodLog, SEED_FOODS } from './useFoodLog'
import type { FoodLogStore } from './lib/foodLogRepo'
import { DEFAULT_GOALS, type FoodEntry, type Goals } from './lib/nutrition'

const makeEntry = (id: string): FoodEntry => ({
  id,
  date: '2026-06-17',
  week: 25,
  weekday: 'Wednesday',
  mealType: 'Lunch',
  description: `Entry ${id}`,
  fat: 1,
  carbs: 2,
  protein: 3,
  fiber: 1,
  calories: 100,
})

// An in-memory FoodLogStore standing in for localStorage. `entries`/`goals`
// start null (nothing stored) so the hook seeds; seed them to model a return
// visit. Records the last-saved values so tests can assert save-on-change.
function makeFakeStore(
  entries: FoodEntry[] | null = null,
  goals: Goals | null = null,
): FoodLogStore {
  return {
    loadEntries: () => entries,
    saveEntries: (next) => {
      entries = next
    },
    loadGoals: () => goals,
    saveGoals: (next) => {
      goals = next
    },
  }
}

describe('useFoodLog — seeding', () => {
  it('seeds the demo entries and default goals when storage is empty', () => {
    const { result } = renderHook(() => useFoodLog(makeFakeStore()))
    expect(result.current.entries).toEqual(SEED_FOODS)
    expect(result.current.goals).toEqual(DEFAULT_GOALS)
  })

  it('loads the stored copy and does NOT re-seed when data exists', () => {
    const stored = [makeEntry('stored-1')]
    const storedGoals: Goals = { ...DEFAULT_GOALS, fiber: 40 }
    const { result } = renderHook(() => useFoodLog(makeFakeStore(stored, storedGoals)))
    expect(result.current.entries).toEqual(stored)
    expect(result.current.entries).not.toEqual(SEED_FOODS)
    expect(result.current.goals.fiber).toBe(40)
  })

  it('treats a stored empty list as real data, not a fresh install', () => {
    // A user who cleared every entry must not have the demo re-seeded over them.
    const { result } = renderHook(() => useFoodLog(makeFakeStore([])))
    expect(result.current.entries).toEqual([])
  })

  it('falls back to seed/defaults when the store returns nothing (corrupt/absent)', () => {
    const { result } = renderHook(() => useFoodLog(makeFakeStore(null, null)))
    expect(result.current.entries).toEqual(SEED_FOODS)
    expect(result.current.goals).toEqual(DEFAULT_GOALS)
  })
})

describe('useFoodLog — mutations', () => {
  it('adds, deletes and updates goals in local state', () => {
    const { result } = renderHook(() => useFoodLog(makeFakeStore([])))
    const entry = makeEntry('e-1')

    act(() => result.current.addEntry(entry))
    expect(result.current.entries).toContainEqual(entry)

    act(() => result.current.deleteEntry('e-1'))
    expect(result.current.entries).not.toContainEqual(entry)

    const goals: Goals = { ...DEFAULT_GOALS, protein: 200 }
    act(() => result.current.setGoals(goals))
    expect(result.current.goals).toEqual(goals)
  })
})

describe('useFoodLog — persistence', () => {
  it('writes the initial seed back to the store on mount', () => {
    const store = makeFakeStore()
    renderHook(() => useFoodLog(store))
    // The seed is persisted immediately, so a later cleared-to-empty state is
    // distinguishable from a first-ever load.
    expect(store.loadEntries()).toEqual(SEED_FOODS)
    expect(store.loadGoals()).toEqual(DEFAULT_GOALS)
  })

  it('saves entries to the store on every change', () => {
    const store = makeFakeStore([])
    const { result } = renderHook(() => useFoodLog(store))
    const entry = makeEntry('e-2')

    act(() => result.current.addEntry(entry))
    expect(store.loadEntries()).toEqual([entry])

    act(() => result.current.deleteEntry('e-2'))
    expect(store.loadEntries()).toEqual([])
  })

  it('saves goals to the store on change', () => {
    const store = makeFakeStore([])
    const { result } = renderHook(() => useFoodLog(store))
    const goals: Goals = { ...DEFAULT_GOALS, carbs: 99 }

    act(() => result.current.setGoals(goals))
    expect(store.loadGoals()).toEqual(goals)
  })
})
