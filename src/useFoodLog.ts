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

// Cloud writes are otherwise fire-and-forget: with offline persistence they're
// queued locally and resolve on reconnect, so a rejection means a real failure
// (e.g. permission denied). Log it rather than letting it surface as an
// unhandled rejection. (Surfacing it in the UI is a reasonable future step.)
function reportWriteError(error: unknown): void {
  console.error('Food log cloud write failed:', error)
}

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

  // Signed-in state: populated only by the Firestore subscription, and tagged
  // with the uid it belongs to. The tag means that after an account switch we
  // never surface the previous user's data: until the new user's first snapshot
  // arrives the tag won't match `uid`, so we fall back to empty/defaults.
  const [cloudEntries, setCloudEntries] = useState<{ uid: string; list: FoodEntry[] }>({
    uid: '',
    list: [],
  })
  const [cloudGoals, setCloudGoals] = useState<{ uid: string; value: Goals }>({
    uid: '',
    value: DEFAULT_GOALS,
  })

  // The repo for the current uid, cached across renders. A ref so the mutators
  // read the active backend without re-creating it on every render.
  const repoRef = useRef<{ uid: string; repo: FoodLogRepository } | null>(null)
  // Latest makeRepo and uid, kept in refs so the subscribe effect can stay keyed
  // on `uid` alone and the mutators (stable callbacks) can read the current uid.
  // Updated in an effect (not during render) that runs before the subscribe
  // effect below, so both always read fresh values when `uid` changes.
  const makeRepoRef = useRef(makeRepo)
  const uidRef = useRef(uid)
  useEffect(() => {
    makeRepoRef.current = makeRepo
    uidRef.current = uid
  })

  // Get (or lazily build and cache) the repo for the given uid. Building it here
  // as well as in the subscribe effect means a mutation fired in the same tick
  // as sign-in — before the effect runs — still routes to the cloud, not local.
  const repoFor = (forUid: string): FoodLogRepository => {
    if (repoRef.current?.uid === forUid) return repoRef.current.repo
    const repo = makeRepoRef.current(forUid)
    repoRef.current = { uid: forUid, repo }
    return repo
  }

  useEffect(() => {
    if (uid == null) {
      repoRef.current = null
      return
    }
    const repo = repoFor(uid)
    const unsubEntries = repo.subscribeEntries((list) => setCloudEntries({ uid, list }))
    const unsubGoals = repo.subscribeGoals((value) => setCloudGoals({ uid, value }))
    return () => {
      unsubEntries()
      unsubGoals()
      repoRef.current = null
    }
  }, [uid])

  const addEntry = useCallback((entry: FoodEntry) => {
    const forUid = uidRef.current
    if (forUid != null) {
      repoFor(forUid).addEntry(entry).catch(reportWriteError)
      return
    }
    setLocalEntries((prev) => [...prev, entry])
  }, [])

  const deleteEntry = useCallback((id: string) => {
    const forUid = uidRef.current
    if (forUid != null) {
      repoFor(forUid).deleteEntry(id).catch(reportWriteError)
      return
    }
    setLocalEntries((prev) => prev.filter((f) => f.id !== id))
  }, [])

  const setGoals = useCallback((next: Goals) => {
    const forUid = uidRef.current
    if (forUid != null) {
      repoFor(forUid).setGoals(next).catch(reportWriteError)
      return
    }
    setLocalGoals(next)
  }, [])

  return {
    // Only surface cloud data once it's confirmed to belong to the current uid.
    entries: signedIn ? (cloudEntries.uid === uid ? cloudEntries.list : []) : localEntries,
    goals: signedIn ? (cloudGoals.uid === uid ? cloudGoals.value : DEFAULT_GOALS) : localGoals,
    addEntry,
    deleteEntry,
    setGoals,
  }
}
