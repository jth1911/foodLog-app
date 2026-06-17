import { useCallback, useEffect, useRef, useState } from 'react'
import { DEFAULT_GOALS, type FoodEntry, type Goals } from './lib/nutrition'
import type { FoodLogRepository } from './lib/foodLogRepo'
import { isoWeekOf, weekdayOf } from './lib/dates'

// Fixed date the demo entries live on, decoupled from the real "today" the app
// lands on. Anchoring the seed to a known day keeps it deterministic for
// tests/demos no matter what the clock says.
const SEED_DATE = '2026-05-01'
const SEED_WEEK = isoWeekOf(SEED_DATE)
const SEED_WEEKDAY = weekdayOf(SEED_DATE)

// The signed-out demo experience: a populated day across all three meals.
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

type UseFoodLogArgs = {
  // The signed-in user's uid, or null when signed out.
  uid: string | null
  // Builds a repository for a uid. Read from a ref so an inline function doesn't
  // tear down and re-establish the subscription on every render — only a change
  // of `uid` does.
  makeRepo: (uid: string) => FoodLogRepository
}

/**
 * The food-log data source the Dashboard consumes.
 *
 * Signed out (`uid == null`): falls back to local, in-memory state seeded with
 * the demo entries — exactly the app's original behaviour, working offline.
 *
 * Signed in: subscribes to the user's Firestore documents via `makeRepo(uid)`,
 * so entries and goals sync across every device. On sign-in the local seed is
 * dropped in favour of the cloud copy (merging local→cloud is out of scope).
 */
export function useFoodLog({ uid, makeRepo }: UseFoodLogArgs): FoodLog {
  const signedIn = uid != null

  // Signed-out state: the local demo, mutated in place. Kept separate from the
  // cloud state (rather than reset on sign-in/out) so the effect never has to
  // call setState synchronously — it only does so from subscription callbacks.
  const [localEntries, setLocalEntries] = useState<FoodEntry[]>(SEED_FOODS)
  const [localGoals, setLocalGoals] = useState<Goals>(DEFAULT_GOALS)

  // Signed-in state: populated only by the Firestore subscription. Empty until
  // the first snapshot arrives, so signing in never shows the local seed.
  const [cloudEntries, setCloudEntries] = useState<FoodEntry[]>([])
  const [cloudGoals, setCloudGoals] = useState<Goals>(DEFAULT_GOALS)

  // Holds the active repo while signed in; null while signed out. A ref so the
  // mutators read the current backend without re-creating on every render.
  const repoRef = useRef<FoodLogRepository | null>(null)
  // Latest makeRepo, kept in a ref so it can stay out of the effect deps. Updated
  // in an effect (not during render) and before the subscribe effect below, so
  // the latter always reads the current value when `uid` changes.
  const makeRepoRef = useRef(makeRepo)
  useEffect(() => {
    makeRepoRef.current = makeRepo
  })

  useEffect(() => {
    if (uid == null) {
      repoRef.current = null
      return
    }
    const repo = makeRepoRef.current(uid)
    repoRef.current = repo
    const unsubEntries = repo.subscribeEntries(setCloudEntries)
    const unsubGoals = repo.subscribeGoals(setCloudGoals)
    return () => {
      unsubEntries()
      unsubGoals()
      repoRef.current = null
    }
  }, [uid])

  const addEntry = useCallback((entry: FoodEntry) => {
    const repo = repoRef.current
    if (repo) {
      void repo.addEntry(entry)
      return
    }
    setLocalEntries((prev) => [...prev, entry])
  }, [])

  const deleteEntry = useCallback((id: string) => {
    const repo = repoRef.current
    if (repo) {
      void repo.deleteEntry(id)
      return
    }
    setLocalEntries((prev) => prev.filter((f) => f.id !== id))
  }, [])

  const setGoals = useCallback((next: Goals) => {
    const repo = repoRef.current
    if (repo) {
      void repo.setGoals(next)
      return
    }
    setLocalGoals(next)
  }, [])

  return {
    entries: signedIn ? cloudEntries : localEntries,
    goals: signedIn ? cloudGoals : localGoals,
    addEntry,
    deleteEntry,
    setGoals,
  }
}
