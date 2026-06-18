// Persistence layer for the food log. The hook never touches localStorage
// directly — it goes through a FoodLogStore, so tests can inject an in-memory
// fake and the storage details stay isolated here.

import { MACRO_KEYS, type FoodEntry, type GoalChange, type Goals } from './nutrition'
import { type UserFoodReference } from './foods'

// Versioned keys so a future shape change can migrate (or ignore) old data
// rather than mis-reading it.
export const ENTRIES_KEY = 'foodlog:entries:v1'
// Legacy single-value goals key (pre-#26). Read-only now: kept only so an
// existing install can migrate its one goal into the dated history below.
export const GOALS_KEY = 'foodlog:goals:v1'
// The effective-dated goal history (#26): a list of { effectiveDate, goals }.
export const GOAL_HISTORY_KEY = 'foodlog:goalHistory:v1'
// The user-managed reference foods (#28): a Record of category → foods. Seeded
// once from the static JSON, then the sole source of truth.
export const FOODS_KEY = 'foodlog:foods:v1'

/** A durable store for the single local user's food log. */
export type FoodLogStore = {
  // Returns the stored value, or null when nothing has been stored yet or the
  // stored JSON is missing/corrupt — the caller seeds defaults in that case.
  loadEntries(): FoodEntry[] | null
  saveEntries(entries: FoodEntry[]): void
  loadGoalHistory(): GoalChange[] | null
  saveGoalHistory(history: GoalChange[]): void
  loadFoods(): Record<string, UserFoodReference[]> | null
  saveFoods(foods: Record<string, UserFoodReference[]>): void
  // Read-only access to the legacy single goal, for one-time migration into the
  // history. Returns null when there's nothing legacy to migrate.
  loadLegacyGoals(): Goals | null
}

// Guard against hosts without localStorage. SSR isn't a target (pure client
// app), but this is cheap insurance and keeps the store usable anywhere.
function getStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

// Read and validate a stored value. `isValid` rejects not just unparseable JSON
// but also valid JSON of the wrong shape (e.g. a tampered key holding a non-array
// where entries are expected), so a bad value falls back to seed/defaults instead
// of crashing a consumer like Dashboard's `entries.filter(...)`.
function loadJson<T>(key: string, isValid: (value: unknown) => value is T): T | null {
  const storage = getStorage()
  if (!storage) return null
  const raw = storage.getItem(key)
  if (raw == null) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return isValid(parsed) ? parsed : null
  } catch {
    // Corrupt JSON: treat as absent so the caller falls back to seed/defaults.
    return null
  }
}

// Stored entries must be an array to be safe to iterate/filter; we don't deep-
// validate each element, as malformed individual entries only skew totals rather
// than crash.
function isFoodEntryArray(value: unknown): value is FoodEntry[] {
  return Array.isArray(value)
}

// Stored goals must be a plain object carrying every macro as a finite number;
// anything else (array, null, missing/NaN macro) falls back to the defaults.
function isGoals(value: unknown): value is Goals {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  return MACRO_KEYS.every((key) => Number.isFinite((value as Record<string, unknown>)[key]))
}

// A stored goal history must be an array of entries, each with a string
// effectiveDate and a well-formed goals payload; anything else falls back to a
// seeded default rather than feeding bad shapes to goalsForDate.
function isGoalChange(value: unknown): value is GoalChange {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const { effectiveDate, goals } = value as Record<string, unknown>
  return typeof effectiveDate === 'string' && isGoals(goals)
}

function isGoalHistory(value: unknown): value is GoalChange[] {
  return Array.isArray(value) && value.every(isGoalChange)
}

// A stored user food must carry string id/name/serving plus the three tracked
// macros as finite numbers; fat/fiber are optional so they're not required here.
// A wrong-shaped value falls back to the seed rather than feeding bad data to the
// Foods page or the add-food modal.
function isUserFoodReference(value: unknown): value is UserFoodReference {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'string' &&
    typeof v.food === 'string' &&
    typeof v.serving_size === 'string' &&
    Number.isFinite(v.protein) &&
    Number.isFinite(v.carbs) &&
    Number.isFinite(v.calories)
  )
}

// Stored foods must be a plain object (category → foods) whose every value is an
// array of well-formed user foods.
function isUserFoods(value: unknown): value is Record<string, UserFoodReference[]> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  return Object.values(value as Record<string, unknown>).every(
    (foods) => Array.isArray(foods) && foods.every(isUserFoodReference),
  )
}

function saveJson(key: string, value: unknown): void {
  const storage = getStorage()
  if (!storage) return
  try {
    storage.setItem(key, JSON.stringify(value))
  } catch (error) {
    // A personal log won't hit the quota, but don't let a write blow up the UI.
    console.error('Food log write failed:', error)
  }
}

/** The real store, backed by the browser's localStorage. */
export const localStorageStore: FoodLogStore = {
  loadEntries: () => loadJson(ENTRIES_KEY, isFoodEntryArray),
  saveEntries: (entries) => saveJson(ENTRIES_KEY, entries),
  loadGoalHistory: () => loadJson(GOAL_HISTORY_KEY, isGoalHistory),
  saveGoalHistory: (history) => saveJson(GOAL_HISTORY_KEY, history),
  loadFoods: () => loadJson(FOODS_KEY, isUserFoods),
  saveFoods: (foods) => saveJson(FOODS_KEY, foods),
  loadLegacyGoals: () => loadJson(GOALS_KEY, isGoals),
}
