import { useCallback, useEffect, useState } from 'react'
import {
  DEFAULT_GOALS,
  GOALS_EPOCH,
  type FoodEntry,
  type GoalChange,
  type Goals,
} from './lib/nutrition'
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
  // The effective-dated goal history, sorted ascending by effectiveDate. The
  // store guarantees at least one entry, so every date resolves to a goal.
  goalHistory: GoalChange[]
  addEntry: (entry: FoodEntry) => void
  deleteEntry: (id: string) => void
  // Append (or, for an existing effective date, replace) a goal change.
  addGoalChange: (effectiveDate: string, goals: Goals) => void
  // Delete the change at this effective date. No-op on the last remaining entry
  // so a date can always resolve to a real goal.
  deleteGoalChange: (effectiveDate: string) => void
}

const byEffectiveDate = (a: GoalChange, b: GoalChange) =>
  a.effectiveDate.localeCompare(b.effectiveDate)

// Resolve the initial goal history: a stored history wins; otherwise migrate a
// legacy single goal into one epoch-dated entry; otherwise seed the defaults.
// Either fallback yields a non-empty history so every date resolves.
function initialGoalHistory(store: FoodLogStore): GoalChange[] {
  const stored = store.loadGoalHistory()
  if (stored && stored.length > 0) return [...stored].sort(byEffectiveDate)
  const legacy = store.loadLegacyGoals()
  return [{ effectiveDate: GOALS_EPOCH, goals: legacy ?? DEFAULT_GOALS }]
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
  const [goalHistory, setGoalHistory] = useState<GoalChange[]>(() => initialGoalHistory(store))

  // Persist on every change, and on mount (which writes the initial seed/
  // migrated history back, so a later edited-to-one state isn't re-migrated).
  useEffect(() => {
    store.saveEntries(entries)
  }, [store, entries])
  useEffect(() => {
    store.saveGoalHistory(goalHistory)
  }, [store, goalHistory])

  const addEntry = useCallback((entry: FoodEntry) => {
    setEntries((prev) => [...prev, entry])
  }, [])

  const deleteEntry = useCallback((id: string) => {
    setEntries((prev) => prev.filter((f) => f.id !== id))
  }, [])

  // Upsert by effective date: a change on an existing date replaces that day's
  // goals (an "edit" is a re-add), otherwise it's inserted. Kept sorted so
  // resolution and display order stay consistent.
  const addGoalChange = useCallback((effectiveDate: string, goals: Goals) => {
    setGoalHistory((prev) =>
      [...prev.filter((e) => e.effectiveDate !== effectiveDate), { effectiveDate, goals }].sort(
        byEffectiveDate,
      ),
    )
  }, [])

  // Never remove the last entry — every date must still resolve to a goal.
  const deleteGoalChange = useCallback((effectiveDate: string) => {
    setGoalHistory((prev) =>
      prev.length <= 1 ? prev : prev.filter((e) => e.effectiveDate !== effectiveDate),
    )
  }, [])

  return { entries, goalHistory, addEntry, deleteEntry, addGoalChange, deleteGoalChange }
}
