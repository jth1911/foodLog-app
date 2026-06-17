import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useFoodLog, SEED_FOODS } from './useFoodLog'
import type { FoodLogRepository } from './lib/foodLogRepo'
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

// An in-memory FoodLogRepository: holds state and pushes it to subscribers,
// standing in for Firestore so the hook can be tested without the SDK.
function makeFakeRepo(initial: FoodEntry[] = [], initialGoals: Goals = DEFAULT_GOALS) {
  let entries = [...initial]
  let goals = { ...initialGoals }
  let entryCb: ((e: FoodEntry[]) => void) | null = null
  let goalCb: ((g: Goals) => void) | null = null
  const repo: FoodLogRepository = {
    subscribeEntries(cb) {
      entryCb = cb
      cb([...entries])
      return () => {
        entryCb = null
      }
    },
    async addEntry(entry) {
      entries = [...entries, entry]
      entryCb?.([...entries])
    },
    async deleteEntry(id) {
      entries = entries.filter((e) => e.id !== id)
      entryCb?.([...entries])
    },
    subscribeGoals(cb) {
      goalCb = cb
      cb({ ...goals })
      return () => {
        goalCb = null
      }
    },
    async setGoals(next) {
      goals = { ...next }
      goalCb?.({ ...goals })
    },
  }
  return repo
}

describe('useFoodLog — signed out', () => {
  it('exposes the seed entries and default goals', () => {
    const { result } = renderHook(() => useFoodLog({ uid: null, makeRepo: () => makeFakeRepo() }))
    expect(result.current.entries).toEqual(SEED_FOODS)
    expect(result.current.goals).toEqual(DEFAULT_GOALS)
  })

  it('mutates local state on add / delete / setGoals', () => {
    const { result } = renderHook(() => useFoodLog({ uid: null, makeRepo: () => makeFakeRepo() }))
    const entry = makeEntry('local-1')
    act(() => result.current.addEntry(entry))
    expect(result.current.entries).toContainEqual(entry)
    act(() => result.current.deleteEntry('local-1'))
    expect(result.current.entries).not.toContainEqual(entry)

    const goals: Goals = { ...DEFAULT_GOALS, protein: 200 }
    act(() => result.current.setGoals(goals))
    expect(result.current.goals).toEqual(goals)
  })
})

describe('useFoodLog — signed in', () => {
  it('subscribes to the repo and surfaces its entries and goals', () => {
    const repo = makeFakeRepo([makeEntry('cloud-1')], { ...DEFAULT_GOALS, fiber: 40 })
    const { result } = renderHook(() => useFoodLog({ uid: 'u1', makeRepo: () => repo }))
    expect(result.current.entries).toEqual([makeEntry('cloud-1')])
    expect(result.current.goals.fiber).toBe(40)
  })

  it('routes add / delete / setGoals through the repo (reflected via subscription)', async () => {
    const repo = makeFakeRepo()
    const { result } = renderHook(() => useFoodLog({ uid: 'u1', makeRepo: () => repo }))
    expect(result.current.entries).toEqual([])

    const entry = makeEntry('cloud-2')
    await act(async () => {
      result.current.addEntry(entry)
    })
    expect(result.current.entries).toEqual([entry])

    await act(async () => {
      result.current.deleteEntry('cloud-2')
    })
    expect(result.current.entries).toEqual([])

    const goals: Goals = { ...DEFAULT_GOALS, carbs: 99 }
    await act(async () => {
      result.current.setGoals(goals)
    })
    expect(result.current.goals).toEqual(goals)
  })

  it('drops the local seed and adopts the cloud copy when a user signs in', () => {
    const repo = makeFakeRepo([makeEntry('cloud-3')])
    const { result, rerender } = renderHook(
      ({ uid }: { uid: string | null }) => useFoodLog({ uid, makeRepo: () => repo }),
      { initialProps: { uid: null as string | null } },
    )
    // Signed out: seed visible.
    expect(result.current.entries).toEqual(SEED_FOODS)
    // Sign in: the seed is dropped in favour of the cloud entries.
    rerender({ uid: 'u1' })
    expect(result.current.entries).toEqual([makeEntry('cloud-3')])
    expect(result.current.entries).not.toEqual(SEED_FOODS)
  })

  it('returns to the seed/demo state on sign-out', () => {
    const repo = makeFakeRepo([makeEntry('cloud-4')])
    const { result, rerender } = renderHook(
      ({ uid }: { uid: string | null }) => useFoodLog({ uid, makeRepo: () => repo }),
      { initialProps: { uid: 'u1' as string | null } },
    )
    expect(result.current.entries).toEqual([makeEntry('cloud-4')])
    rerender({ uid: null })
    expect(result.current.entries).toEqual(SEED_FOODS)
  })
})
