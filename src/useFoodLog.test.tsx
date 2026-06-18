import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useFoodLog, SEED_FOODS } from './useFoodLog'
import type { FoodLogStore } from './lib/foodLogRepo'
import { seedFoodsFromJson, type UserFoodReference } from './lib/foods'
import { type WeightEntry } from './lib/weight'
import { type FluidEntry } from './lib/fluid'
import { DEFAULT_GOALS, GOALS_EPOCH, type FoodEntry, type GoalChange, type Goals } from './lib/nutrition'

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

// An in-memory FoodLogStore standing in for localStorage. `entries`/`history`
// start null (nothing stored) so the hook seeds; seed them to model a return
// visit. `legacy` models a pre-#26 single goal awaiting migration. Records the
// last-saved values so tests can assert save-on-change.
function makeFakeStore(
  entries: FoodEntry[] | null = null,
  history: GoalChange[] | null = null,
  legacy: Goals | null = null,
  foods: Record<string, UserFoodReference[]> | null = null,
  weights: WeightEntry[] | null = null,
  targetWeight: number | null = null,
  fluids: FluidEntry[] | null = null,
  targetFluid: number | null = null,
): FoodLogStore {
  return {
    loadEntries: () => entries,
    saveEntries: (next) => {
      entries = next
    },
    loadGoalHistory: () => history,
    saveGoalHistory: (next) => {
      history = next
    },
    loadFoods: () => foods,
    saveFoods: (next) => {
      foods = next
    },
    loadWeights: () => weights,
    saveWeights: (next) => {
      weights = next
    },
    loadTargetWeight: () => targetWeight,
    saveTargetWeight: (next) => {
      targetWeight = next
    },
    loadFluids: () => fluids,
    saveFluids: (next) => {
      fluids = next
    },
    loadTargetFluid: () => targetFluid,
    saveTargetFluid: (next) => {
      targetFluid = next
    },
    loadLegacyGoals: () => legacy,
  }
}

const makeFluid = (id: string, over: Partial<FluidEntry> = {}): FluidEntry => ({
  id,
  date: '2026-06-17',
  week: 25,
  weekday: 'Wednesday',
  drinkType: 'Water',
  oz: 16,
  calories: 0,
  ...over,
})

describe('useFoodLog — seeding', () => {
  it('seeds the demo entries and a default goal history when storage is empty', () => {
    const { result } = renderHook(() => useFoodLog(makeFakeStore()))
    expect(result.current.entries).toEqual(SEED_FOODS)
    expect(result.current.goalHistory).toEqual([
      { effectiveDate: GOALS_EPOCH, goals: DEFAULT_GOALS },
    ])
  })

  it('migrates a legacy single goal into one epoch-dated history entry', () => {
    const legacy: Goals = { ...DEFAULT_GOALS, protein: 99 }
    const { result } = renderHook(() => useFoodLog(makeFakeStore(null, null, legacy)))
    expect(result.current.goalHistory).toEqual([{ effectiveDate: GOALS_EPOCH, goals: legacy }])
  })

  it('prefers a stored history over legacy migration', () => {
    const history: GoalChange[] = [{ effectiveDate: '2026-01-01', goals: DEFAULT_GOALS }]
    const legacy: Goals = { ...DEFAULT_GOALS, protein: 99 }
    const { result } = renderHook(() => useFoodLog(makeFakeStore(null, history, legacy)))
    expect(result.current.goalHistory).toEqual(history)
  })

  it('loads the stored copy and does NOT re-seed when data exists', () => {
    const stored = [makeEntry('stored-1')]
    const history: GoalChange[] = [
      { effectiveDate: '2026-01-01', goals: { ...DEFAULT_GOALS, fiber: 40 } },
    ]
    const { result } = renderHook(() => useFoodLog(makeFakeStore(stored, history)))
    expect(result.current.entries).toEqual(stored)
    expect(result.current.entries).not.toEqual(SEED_FOODS)
    expect(result.current.goalHistory).toEqual(history)
  })

  it('treats a stored empty entry list as real data, not a fresh install', () => {
    // A user who cleared every entry must not have the demo re-seeded over them.
    const { result } = renderHook(() => useFoodLog(makeFakeStore([])))
    expect(result.current.entries).toEqual([])
  })

  it('falls back to seed/defaults when the store returns nothing (corrupt/absent)', () => {
    const { result } = renderHook(() => useFoodLog(makeFakeStore(null, null)))
    expect(result.current.entries).toEqual(SEED_FOODS)
    expect(result.current.goalHistory).toEqual([
      { effectiveDate: GOALS_EPOCH, goals: DEFAULT_GOALS },
    ])
  })

  it('sorts a stored history ascending by effective date', () => {
    const history: GoalChange[] = [
      { effectiveDate: '2026-05-01', goals: DEFAULT_GOALS },
      { effectiveDate: '2026-01-01', goals: DEFAULT_GOALS },
    ]
    const { result } = renderHook(() => useFoodLog(makeFakeStore(null, history)))
    expect(result.current.goalHistory.map((e) => e.effectiveDate)).toEqual([
      '2026-01-01',
      '2026-05-01',
    ])
  })
})

describe('useFoodLog — entry mutations', () => {
  it('adds and deletes entries in local state', () => {
    const { result } = renderHook(() => useFoodLog(makeFakeStore([])))
    const entry = makeEntry('e-1')

    act(() => result.current.addEntry(entry))
    expect(result.current.entries).toContainEqual(entry)

    act(() => result.current.deleteEntry('e-1'))
    expect(result.current.entries).not.toContainEqual(entry)
  })

  it('updates an existing entry in place by id', () => {
    const { result } = renderHook(() => useFoodLog(makeFakeStore([])))
    const entry = makeEntry('e-1')

    act(() => result.current.addEntry(entry))
    const updated = { ...entry, description: 'Edited', protein: 50 }
    act(() => result.current.updateEntry(updated))

    expect(result.current.entries).toEqual([updated])
  })

  it('appends a batch of entries in one update', () => {
    const { result } = renderHook(() => useFoodLog(makeFakeStore([])))
    const batch = [makeEntry('b-1'), makeEntry('b-2'), makeEntry('b-3')]

    act(() => result.current.addEntries(batch))
    expect(result.current.entries).toEqual(batch)
  })

  it('addEntries is a no-op for an empty batch', () => {
    const { result } = renderHook(() => useFoodLog(makeFakeStore([])))
    act(() => result.current.addEntries([]))
    expect(result.current.entries).toEqual([])
  })
})

describe('useFoodLog — goal history mutations', () => {
  const seeded = (): GoalChange[] => [{ effectiveDate: GOALS_EPOCH, goals: DEFAULT_GOALS }]

  it('inserts a goal change in sorted order', () => {
    const { result } = renderHook(() => useFoodLog(makeFakeStore([], seeded())))
    act(() => result.current.addGoalChange('2026-05-01', { ...DEFAULT_GOALS, protein: 130 }))
    act(() => result.current.addGoalChange('2026-01-01', { ...DEFAULT_GOALS, protein: 120 }))
    expect(result.current.goalHistory.map((e) => e.effectiveDate)).toEqual([
      GOALS_EPOCH,
      '2026-01-01',
      '2026-05-01',
    ])
  })

  it('replaces the entry when adding on an existing effective date', () => {
    const { result } = renderHook(() => useFoodLog(makeFakeStore([], seeded())))
    act(() => result.current.addGoalChange('2026-01-01', { ...DEFAULT_GOALS, protein: 120 }))
    act(() => result.current.addGoalChange('2026-01-01', { ...DEFAULT_GOALS, protein: 140 }))
    const onDate = result.current.goalHistory.filter((e) => e.effectiveDate === '2026-01-01')
    expect(onDate).toHaveLength(1)
    expect(onDate[0].goals.protein).toBe(140)
  })

  it('deletes a goal change by effective date', () => {
    const start: GoalChange[] = [
      { effectiveDate: '2026-01-01', goals: DEFAULT_GOALS },
      { effectiveDate: '2026-05-01', goals: DEFAULT_GOALS },
    ]
    const { result } = renderHook(() => useFoodLog(makeFakeStore([], start)))
    act(() => result.current.deleteGoalChange('2026-01-01'))
    expect(result.current.goalHistory.map((e) => e.effectiveDate)).toEqual(['2026-05-01'])
  })

  it('refuses to delete the last remaining entry', () => {
    const { result } = renderHook(() => useFoodLog(makeFakeStore([], seeded())))
    act(() => result.current.deleteGoalChange(GOALS_EPOCH))
    expect(result.current.goalHistory).toEqual(seeded())
  })
})

describe('useFoodLog — reference foods', () => {
  const storedFoods: Record<string, UserFoodReference[]> = {
    Custom: [{ id: 'f1', food: 'Protein bar', serving_size: '1 bar', protein: 20, carbs: 25, calories: 210 }],
  }

  it('seeds the foods from the JSON when storage is empty', () => {
    const { result } = renderHook(() => useFoodLog(makeFakeStore()))
    expect(result.current.foods).toEqual(seedFoodsFromJson())
  })

  it('loads stored foods over the seed', () => {
    const { result } = renderHook(() => useFoodLog(makeFakeStore(null, null, null, storedFoods)))
    expect(result.current.foods).toEqual(storedFoods)
  })

  it('adds a food with a generated id to a category', () => {
    const { result } = renderHook(() => useFoodLog(makeFakeStore(null, null, null, { Custom: [] })))
    act(() =>
      result.current.addFood('Custom', {
        food: 'Tofu',
        serving_size: '1/2 cup',
        protein: 10,
        carbs: 2,
        calories: 80,
      }),
    )
    expect(result.current.foods.Custom).toHaveLength(1)
    expect(result.current.foods.Custom[0]).toMatchObject({ food: 'Tofu', protein: 10 })
    expect(typeof result.current.foods.Custom[0].id).toBe('string')
  })

  it('updates a food in place by id', () => {
    const { result } = renderHook(() => useFoodLog(makeFakeStore(null, null, null, storedFoods)))
    act(() => result.current.updateFood('Custom', { ...storedFoods.Custom[0], protein: 25 }))
    expect(result.current.foods.Custom[0].protein).toBe(25)
    expect(result.current.foods.Custom).toHaveLength(1)
  })

  it('deletes a food by id', () => {
    const { result } = renderHook(() => useFoodLog(makeFakeStore(null, null, null, storedFoods)))
    act(() => result.current.deleteFood('Custom', 'f1'))
    expect(result.current.foods.Custom).toEqual([])
  })

  it('adds an empty category without clobbering an existing one', () => {
    const { result } = renderHook(() => useFoodLog(makeFakeStore(null, null, null, storedFoods)))
    act(() => result.current.addCategory('Snacks'))
    expect(result.current.foods.Snacks).toEqual([])
    act(() => result.current.addCategory('Custom')) // already exists → untouched
    expect(result.current.foods.Custom).toEqual(storedFoods.Custom)
  })

  it('deletes a whole category', () => {
    const { result } = renderHook(() => useFoodLog(makeFakeStore(null, null, null, storedFoods)))
    act(() => result.current.deleteCategory('Custom'))
    expect(result.current.foods).not.toHaveProperty('Custom')
  })

  it('saves foods to the store on change', () => {
    const store = makeFakeStore(null, null, null, { Custom: [] })
    const { result } = renderHook(() => useFoodLog(store))
    act(() => result.current.addCategory('Extra'))
    expect(store.loadFoods()).toHaveProperty('Extra')
  })
})

describe('useFoodLog — weights', () => {
  it('loads a stored weight log sorted by date, without inventing days', () => {
    const stored: WeightEntry[] = [
      { date: '2026-06-04', lb: 179 },
      { date: '2026-06-01', lb: 180 },
    ]
    const { result } = renderHook(() => useFoodLog(makeFakeStore(null, null, null, null, stored)))
    // Only the two recorded days exist (no carry-forward fill), sorted ascending.
    expect(result.current.weights).toEqual([
      { date: '2026-06-01', lb: 180 },
      { date: '2026-06-04', lb: 179 },
    ])
  })

  it('starts with an empty weight log when storage is empty', () => {
    const { result } = renderHook(() => useFoodLog(makeFakeStore()))
    expect(result.current.weights).toEqual([])
  })

  it('upserts a single day without auto-filling the gaps', () => {
    const stored: WeightEntry[] = [{ date: '2026-06-01', lb: 180 }]
    const { result } = renderHook(() => useFoodLog(makeFakeStore(null, null, null, null, stored)))

    act(() => result.current.setWeight('2026-06-03', 178))
    const onDate = (d: string) => result.current.weights.find((w) => w.date === d)
    expect(onDate('2026-06-02')).toBeUndefined() // no carried day invented
    expect(onDate('2026-06-03')).toEqual({ date: '2026-06-03', lb: 178 })
    expect(result.current.weights).toHaveLength(2)

    // Re-entering the same day overwrites it rather than duplicating.
    act(() => result.current.setWeight('2026-06-03', 177))
    expect(result.current.weights.filter((w) => w.date === '2026-06-03')).toHaveLength(1)
    expect(onDate('2026-06-03')!.lb).toBe(177)
  })

  it('saves the weight log to the store on change', () => {
    const store = makeFakeStore(null, null, null, null, [{ date: '2026-06-01', lb: 180 }])
    const { result } = renderHook(() => useFoodLog(store))
    act(() => result.current.setWeight('2026-06-02', 179))
    expect(store.loadWeights()!.find((w) => w.date === '2026-06-02')).toEqual({
      date: '2026-06-02',
      lb: 179,
    })
  })
})

describe('useFoodLog — target weight', () => {
  it('defaults to null when no target is stored', () => {
    const { result } = renderHook(() => useFoodLog(makeFakeStore()))
    expect(result.current.targetWeight).toBeNull()
  })

  it('loads a stored target weight', () => {
    const { result } = renderHook(() =>
      useFoodLog(makeFakeStore(null, null, null, null, null, 165)),
    )
    expect(result.current.targetWeight).toBe(165)
  })

  it('sets and persists the target weight', () => {
    const store = makeFakeStore()
    const { result } = renderHook(() => useFoodLog(store))
    act(() => result.current.setTargetWeight(170))
    expect(result.current.targetWeight).toBe(170)
    expect(store.loadTargetWeight()).toBe(170)
  })
})

describe('useFoodLog — fluids', () => {
  it('starts blank with no seeded drinks when storage is empty', () => {
    const { result } = renderHook(() => useFoodLog(makeFakeStore()))
    expect(result.current.fluids).toEqual([])
  })

  it('loads a stored fluid log', () => {
    const stored = [makeFluid('d1')]
    const { result } = renderHook(() =>
      useFoodLog(makeFakeStore(null, null, null, null, null, null, stored)),
    )
    expect(result.current.fluids).toEqual(stored)
  })

  it('adds, updates and deletes drinks, persisting each change', () => {
    const store = makeFakeStore()
    const { result } = renderHook(() => useFoodLog(store))

    act(() => result.current.addFluid(makeFluid('d1', { drinkType: 'Juice', oz: 8, calories: 110 })))
    expect(result.current.fluids).toHaveLength(1)
    expect(store.loadFluids()).toHaveLength(1)

    act(() => result.current.updateFluid(makeFluid('d1', { drinkType: 'Soda', oz: 12, calories: 150 })))
    expect(result.current.fluids[0]).toMatchObject({ drinkType: 'Soda', oz: 12, calories: 150 })

    act(() => result.current.deleteFluid('d1'))
    expect(result.current.fluids).toEqual([])
    expect(store.loadFluids()).toEqual([])
  })
})

describe('useFoodLog — target fluid', () => {
  it('defaults to null when no target is stored', () => {
    const { result } = renderHook(() => useFoodLog(makeFakeStore()))
    expect(result.current.targetFluid).toBeNull()
  })

  it('loads a stored target fluid', () => {
    const { result } = renderHook(() =>
      useFoodLog(makeFakeStore(null, null, null, null, null, null, null, 64)),
    )
    expect(result.current.targetFluid).toBe(64)
  })

  it('sets and persists the target fluid', () => {
    const store = makeFakeStore()
    const { result } = renderHook(() => useFoodLog(store))
    act(() => result.current.setTargetFluid(80))
    expect(result.current.targetFluid).toBe(80)
    expect(store.loadTargetFluid()).toBe(80)
  })
})

describe('useFoodLog — persistence', () => {
  it('writes the initial seed back to the store on mount', () => {
    const store = makeFakeStore()
    renderHook(() => useFoodLog(store))
    // The seed is persisted immediately, so a later cleared-to-empty state is
    // distinguishable from a first-ever load.
    expect(store.loadEntries()).toEqual(SEED_FOODS)
    expect(store.loadGoalHistory()).toEqual([{ effectiveDate: GOALS_EPOCH, goals: DEFAULT_GOALS }])
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

  it('saves an updated entry to the store', () => {
    const store = makeFakeStore([])
    const { result } = renderHook(() => useFoodLog(store))
    const entry = makeEntry('e-3')

    act(() => result.current.addEntry(entry))
    act(() => result.current.updateEntry({ ...entry, calories: 999 }))
    expect(store.loadEntries()).toEqual([{ ...entry, calories: 999 }])
  })

  it('saves the goal history to the store on change', () => {
    const store = makeFakeStore([], [{ effectiveDate: GOALS_EPOCH, goals: DEFAULT_GOALS }])
    const { result } = renderHook(() => useFoodLog(store))

    act(() => result.current.addGoalChange('2026-05-01', { ...DEFAULT_GOALS, carbs: 99 }))
    expect(store.loadGoalHistory()).toEqual([
      { effectiveDate: GOALS_EPOCH, goals: DEFAULT_GOALS },
      { effectiveDate: '2026-05-01', goals: { ...DEFAULT_GOALS, carbs: 99 } },
    ])
  })
})
