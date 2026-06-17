// Persistence layer for the food log. The hook never touches localStorage
// directly — it goes through a FoodLogStore, so tests can inject an in-memory
// fake and the storage details stay isolated here.

import { type FoodEntry, type Goals } from './nutrition'

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

function loadJson<T>(key: string): T | null {
  const storage = getStorage()
  if (!storage) return null
  const raw = storage.getItem(key)
  if (raw == null) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    // Corrupt JSON: treat as absent so the caller falls back to seed/defaults.
    return null
  }
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
  loadEntries: () => loadJson<FoodEntry[]>(ENTRIES_KEY),
  saveEntries: (entries) => saveJson(ENTRIES_KEY, entries),
  loadGoals: () => loadJson<Goals>(GOALS_KEY),
  saveGoals: (goals) => saveJson(GOALS_KEY, goals),
}
