// Persistence layer for the food log. The hook never touches localStorage
// directly — it goes through a FoodLogStore, so tests can inject an in-memory
// fake and the storage details stay isolated here.

import { MACRO_KEYS, type FoodEntry, type Goals } from './nutrition'

// Versioned keys so a future shape change can migrate (or ignore) old data
// rather than mis-reading it.
export const ENTRIES_KEY = 'foodlog:entries:v1'
export const GOALS_KEY = 'foodlog:goals:v1'

/** A durable store for the single local user's food log. */
export type FoodLogStore = {
  // Returns the stored value, or null when nothing has been stored yet or the
  // stored JSON is missing/corrupt — the caller seeds defaults in that case.
  loadEntries(): FoodEntry[] | null
  saveEntries(entries: FoodEntry[]): void
  loadGoals(): Goals | null
  saveGoals(goals: Goals): void
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
  loadGoals: () => loadJson(GOALS_KEY, isGoals),
  saveGoals: (goals) => saveJson(GOALS_KEY, goals),
}
