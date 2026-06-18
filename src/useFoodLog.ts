import { useCallback, useEffect, useState } from 'react'
import {
  DEFAULT_GOALS,
  GOALS_EPOCH,
  type FoodEntry,
  type GoalChange,
  type Goals,
} from './lib/nutrition'
import { localStorageStore, type FoodLogStore } from './lib/foodLogRepo'
import { seedFoodsFromJson, type UserFoodReference } from './lib/foods'
import { type WeightEntry } from './lib/weight'
import { DEFAULT_TARGET_FLUID, type FluidEntry } from './lib/fluid'
import { isoWeekOf, weekdayOf } from './lib/dates'
import { log } from './lib/logger'

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
  // The user-managed reference foods, keyed by category. Seeded from the static
  // JSON on first load, then the sole source of truth.
  foods: Record<string, UserFoodReference[]>
  // The daily weight log, sorted ascending with carry-forward gaps materialised
  // up to today (so a day without an explicit weigh-in still has a value).
  weights: WeightEntry[]
  // The target weight in pounds, or null when none has been set yet.
  targetWeight: number | null
  // The daily fluid log. Like weights, starts blank — only explicitly-logged
  // drinks are stored, with no seeding.
  fluids: FluidEntry[]
  // The daily fluid target in fluid ounces, or null when none has been set yet.
  targetFluid: number | null
  addEntry: (entry: FoodEntry) => void
  // Append a batch of entries in one update, e.g. a CSV bulk import.
  addEntries: (entries: FoodEntry[]) => void
  // Replace an existing entry in place, matched by id (other entries untouched).
  updateEntry: (updated: FoodEntry) => void
  deleteEntry: (id: string) => void
  // Append (or, for an existing effective date, replace) a goal change.
  addGoalChange: (effectiveDate: string, goals: Goals) => void
  // Delete the change at this effective date. No-op on the last remaining entry
  // so a date can always resolve to a real goal.
  deleteGoalChange: (effectiveDate: string) => void
  // Reference-food mutations. addFood stamps a fresh id; updateFood replaces by
  // id within its category; deleteFood/Category remove by id/name.
  addFood: (category: string, food: Omit<UserFoodReference, 'id'>) => void
  updateFood: (category: string, food: UserFoodReference) => void
  deleteFood: (category: string, id: string) => void
  addCategory: (name: string) => void
  deleteCategory: (name: string) => void
  // Record (or overwrite) the weight for a day. Editing an inherited day writes
  // a real entry for it; the carry-forward fill is re-applied up to today.
  setWeight: (date: string, lb: number) => void
  // Set the single target weight (pounds).
  setTargetWeight: (lb: number) => void
  // Fluid mutations, mirroring the food-entry ones. addFluid appends, updateFluid
  // replaces by id, deleteFluid removes by id.
  addFluid: (fluid: FluidEntry) => void
  updateFluid: (updated: FluidEntry) => void
  deleteFluid: (id: string) => void
  // Set the single daily fluid target (fluid ounces).
  setTargetFluid: (oz: number) => void
}

const byEffectiveDate = (a: GoalChange, b: GoalChange) =>
  a.effectiveDate.localeCompare(b.effectiveDate)

const byWeightDate = (a: WeightEntry, b: WeightEntry) => a.date.localeCompare(b.date)

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
  const [foods, setFoods] = useState<Record<string, UserFoodReference[]>>(
    () => store.loadFoods() ?? seedFoodsFromJson(),
  )
  // Start blank with no seeded weights. Only explicitly-recorded days are
  // stored — there's no automatic carry-forward (the dashboard's "pull forward"
  // button copies the previous day's weight on demand).
  const [weights, setWeights] = useState<WeightEntry[]>(() =>
    [...(store.loadWeights() ?? [])].sort(byWeightDate),
  )
  const [targetWeight, setTargetWeightState] = useState<number | null>(() =>
    store.loadTargetWeight(),
  )
  // Start blank with no seeded drinks — only explicitly-logged fluids are stored.
  const [fluids, setFluids] = useState<FluidEntry[]>(() => store.loadFluids() ?? [])
  // Default to DEFAULT_TARGET_FLUID when nothing is stored, so the dashboard
  // shows a hydration goal out of the box (persisted on mount, like the seed).
  const [targetFluid, setTargetFluidState] = useState<number | null>(
    () => store.loadTargetFluid() ?? DEFAULT_TARGET_FLUID,
  )

  // Persist on every change, and on mount (which writes the initial seed/
  // migrated history back, so a later edited-to-one state isn't re-migrated).
  useEffect(() => {
    store.saveEntries(entries)
  }, [store, entries])
  useEffect(() => {
    store.saveGoalHistory(goalHistory)
  }, [store, goalHistory])
  useEffect(() => {
    store.saveFoods(foods)
  }, [store, foods])
  useEffect(() => {
    store.saveWeights(weights)
  }, [store, weights])
  // Persist a target once one is set. There's no clearing in v1, so a null
  // target (never set) simply leaves the key absent.
  useEffect(() => {
    if (targetWeight !== null) store.saveTargetWeight(targetWeight)
  }, [store, targetWeight])
  useEffect(() => {
    store.saveFluids(fluids)
  }, [store, fluids])
  // Like the target weight: persist once set, leave the key absent when null.
  useEffect(() => {
    if (targetFluid !== null) store.saveTargetFluid(targetFluid)
  }, [store, targetFluid])

  const addEntry = useCallback((entry: FoodEntry) => {
    log('info', 'Entry added', { description: entry.description, date: entry.date })
    setEntries((prev) => [...prev, entry])
  }, [])

  const addEntries = useCallback((toAdd: FoodEntry[]) => {
    if (toAdd.length === 0) return
    log('info', 'Entries imported', { count: toAdd.length })
    setEntries((prev) => [...prev, ...toAdd])
  }, [])

  const updateEntry = useCallback((updated: FoodEntry) => {
    log('info', 'Entry updated', { id: updated.id, description: updated.description })
    setEntries((prev) => prev.map((f) => (f.id === updated.id ? updated : f)))
  }, [])

  const deleteEntry = useCallback((id: string) => {
    log('info', 'Entry deleted', { id })
    setEntries((prev) => prev.filter((f) => f.id !== id))
  }, [])

  // Upsert by effective date: a change on an existing date replaces that day's
  // goals (an "edit" is a re-add), otherwise it's inserted. Kept sorted so
  // resolution and display order stay consistent.
  const addGoalChange = useCallback((effectiveDate: string, goals: Goals) => {
    log('info', 'Goal change saved', { effectiveDate })
    setGoalHistory((prev) =>
      [...prev.filter((e) => e.effectiveDate !== effectiveDate), { effectiveDate, goals }].sort(
        byEffectiveDate,
      ),
    )
  }, [])

  // Never remove the last entry — every date must still resolve to a goal.
  const deleteGoalChange = useCallback((effectiveDate: string) => {
    log('info', 'Goal change deleted', { effectiveDate })
    setGoalHistory((prev) =>
      prev.length <= 1 ? prev : prev.filter((e) => e.effectiveDate !== effectiveDate),
    )
  }, [])

  const addFood = useCallback((category: string, food: Omit<UserFoodReference, 'id'>) => {
    log('info', 'Food added', { category, food: food.food })
    const withId: UserFoodReference = { ...food, id: crypto.randomUUID() }
    setFoods((prev) => ({ ...prev, [category]: [...(prev[category] ?? []), withId] }))
  }, [])

  const updateFood = useCallback((category: string, food: UserFoodReference) => {
    log('info', 'Food updated', { category, food: food.food })
    setFoods((prev) => ({
      ...prev,
      [category]: (prev[category] ?? []).map((f) => (f.id === food.id ? food : f)),
    }))
  }, [])

  const deleteFood = useCallback((category: string, id: string) => {
    log('info', 'Food deleted', { category, id })
    setFoods((prev) => ({
      ...prev,
      [category]: (prev[category] ?? []).filter((f) => f.id !== id),
    }))
  }, [])

  // Add an empty named bucket. A name that already exists is left untouched so
  // adding doesn't wipe an existing category's foods.
  const addCategory = useCallback((name: string) => {
    log('info', 'Category added', { name })
    setFoods((prev) => (name in prev ? prev : { ...prev, [name]: [] }))
  }, [])

  const deleteCategory = useCallback((name: string) => {
    log('info', 'Category deleted', { name })
    setFoods((prev) => {
      const next = { ...prev }
      delete next[name]
      return next
    })
  }, [])

  // Upsert the day's weight (a re-entry replaces it), kept sorted by date. Only
  // this day changes — other days are never auto-filled.
  const setWeight = useCallback((date: string, lb: number) => {
    log('info', 'Weight logged', { date, lb })
    setWeights((prev) =>
      [...prev.filter((w) => w.date !== date), { date, lb }].sort(byWeightDate),
    )
  }, [])

  const setTargetWeight = useCallback((lb: number) => {
    log('info', 'Target weight set', { lb })
    setTargetWeightState(lb)
  }, [])

  const addFluid = useCallback((fluid: FluidEntry) => {
    log('info', 'Fluid added', { drinkType: fluid.drinkType, oz: fluid.oz, date: fluid.date })
    setFluids((prev) => [...prev, fluid])
  }, [])

  const updateFluid = useCallback((updated: FluidEntry) => {
    log('info', 'Fluid updated', { id: updated.id, drinkType: updated.drinkType })
    setFluids((prev) => prev.map((f) => (f.id === updated.id ? updated : f)))
  }, [])

  const deleteFluid = useCallback((id: string) => {
    log('info', 'Fluid deleted', { id })
    setFluids((prev) => prev.filter((f) => f.id !== id))
  }, [])

  const setTargetFluid = useCallback((oz: number) => {
    log('info', 'Target fluid set', { oz })
    setTargetFluidState(oz)
  }, [])

  return {
    entries,
    goalHistory,
    foods,
    weights,
    targetWeight,
    fluids,
    targetFluid,
    addEntry,
    addEntries,
    updateEntry,
    deleteEntry,
    addGoalChange,
    deleteGoalChange,
    addFood,
    updateFood,
    deleteFood,
    addCategory,
    deleteCategory,
    setWeight,
    setTargetWeight,
    addFluid,
    updateFluid,
    deleteFluid,
    setTargetFluid,
  }
}
