import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_GOALS, type FoodEntry, type Goals } from './lib/nutrition'
import { localStorageStore, type FoodLogStore } from './lib/foodLogRepo'
import { isoWeekOf, weekdayOf } from './lib/dates'

// Fixed date the demo entries live on, decoupled from the real "today" the app
// lands on. Anchoring the seed to a known day keeps it deterministic for
// tests/demos no matter what the clock says.
const SEED_DATE = '2026-05-01'
const SEED_WEEK = isoWeekOf(SEED_DATE)
const SEED_WEEKDAY = weekdayOf(SEED_DATE)

// The first-run demo experience: a populated day across all three meals. Seeded
// only when storage is empty (see useFoodLog); once real data exists it never
// re-seeds.
export const SEED_FOODS: FoodEntry[] = [
  {
    id: '1',
    date: SEED_DATE,
    week: SEED_WEEK,
    weekday: SEED_WEEKDAY,
    mealType: 'Breakfast',
    description: 'Greek yogurt with berries & granola',
    fat: 9,
    carbs: 34,
    protein: 22,
    fiber: 5,
    calories: 320,
  },
  {
    id: '2',
    date: SEED_DATE,
    week: SEED_WEEK,
    weekday: SEED_WEEKDAY,
    mealType: 'Breakfast',
    description: 'Black coffee',
    fat: 0,
    carbs: 0,
    protein: 0,
    fiber: 0,
    calories: 5,
  },
  {
    id: '3',
    date: SEED_DATE,
    week: SEED_WEEK,
    weekday: SEED_WEEKDAY,
    mealType: 'Lunch',
    description: 'Grilled chicken salad',
    fat: 18,
    carbs: 20,
    protein: 43,
    fiber: 7,
    calories: 430,
  },
  {
    id: '4',
    date: SEED_DATE,
    week: SEED_WEEK,
    weekday: SEED_WEEKDAY,
    mealType: 'Dinner',
    description: 'Salmon, quinoa & broccoli',
    fat: 24,
    carbs: 45,
    protein: 40,
    fiber: 9,
    calories: 560,
  },
  {
    id: '5',
    date: SEED_DATE,
    week: SEED_WEEK,
    weekday: SEED_WEEKDAY,
    mealType: 'Dinner',
    description: 'Dark chocolate square',
    fat: 7,
    carbs: 13,
    protein: 2,
    fiber: 2,
    calories: 120,
  },
]

export type FoodLog = {
  entries: FoodEntry[]
  goals: Goals
  addEntry: (entry: FoodEntry) => void
  deleteEntry: (id: string) => void
  setGoals: (goals: Goals) => void
}

/**
 * The food-log data source the Dashboard consumes, persisted to localStorage.
 *
 * On first-ever load (nothing stored) it seeds the demo entries and default
 * goals; once anything has been written the stored copy wins and the demo never
 * re-seeds. Every change — and the initial seed itself — is written straight
 * back to the store, so clearing every entry later can't be mistaken for a fresh
 * install that would re-seed.
 *
 * `store` is injectable so tests can pass an in-memory fake.
 */
export function useFoodLog(store: FoodLogStore = localStorageStore): FoodLog {
  const [entries, setEntries] = useState<FoodEntry[]>(() => store.loadEntries() ?? SEED_FOODS)
  const [goals, setGoalsState] = useState<Goals>(() => store.loadGoals() ?? DEFAULT_GOALS)

  // Persist on every change, and on mount (which writes the initial seed back).
  useEffect(() => {
    store.saveEntries(entries)
  }, [store, entries])
  useEffect(() => {
    store.saveGoals(goals)
  }, [store, goals])

  const addEntry = useCallback((entry: FoodEntry) => {
    setEntries((prev) => [...prev, entry])
  }, [])

  const deleteEntry = useCallback((id: string) => {
    setEntries((prev) => prev.filter((f) => f.id !== id))
  }, [])

  const setGoals = useCallback((next: Goals) => {
    setGoalsState(next)
  }, [])

  return { entries, goals, addEntry, deleteEntry, setGoals }
}
