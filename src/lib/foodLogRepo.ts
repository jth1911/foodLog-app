// Data layer for the food log. The Dashboard never talks to Firestore directly —
// it goes through a FoodLogRepository, so tests can inject an in-memory fake and
// the Firebase SDK stays isolated in `firestoreRepo` (and `firebase.ts`).

import {
  type DocumentData,
  type Firestore,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
} from 'firebase/firestore'
import {
  DEFAULT_GOALS,
  MACRO_KEYS,
  type FoodEntry,
  type Goals,
} from './nutrition'

/** A live food-log store for a single signed-in user. */
export type FoodLogRepository = {
  // Subscribe to the user's entries; calls back with the full list on every
  // change and returns an unsubscribe function.
  subscribeEntries(onChange: (entries: FoodEntry[]) => void): () => void
  addEntry(entry: FoodEntry): Promise<void>
  deleteEntry(id: string): Promise<void>
  // Subscribe to the user's goals, falling back to defaults when unset.
  subscribeGoals(onChange: (goals: Goals) => void): () => void
  setGoals(goals: Goals): Promise<void>
}

// --- Pure mappers (FoodEntry/Goals <-> Firestore document shapes) -----------
// Kept pure and SDK-free so they're unit-testable without Firestore.

/** Strip the id (the doc id carries it) and omit absent optional fields. */
export function entryToDoc(entry: FoodEntry): DocumentData {
  const out: DocumentData = {
    date: entry.date,
    week: entry.week,
    weekday: entry.weekday,
    mealType: entry.mealType,
    description: entry.description,
    fat: entry.fat,
    carbs: entry.carbs,
    protein: entry.protein,
    fiber: entry.fiber,
    calories: entry.calories,
  }
  // Firestore rejects `undefined`, so only write the optionals when set.
  if (entry.servingSize !== undefined) out.servingSize = entry.servingSize
  if (entry.quantity !== undefined) out.quantity = entry.quantity
  return out
}

/** Reconstruct a FoodEntry from its doc id and stored data. */
export function docToEntry(id: string, data: DocumentData): FoodEntry {
  const entry: FoodEntry = {
    id,
    date: data.date,
    week: data.week,
    weekday: data.weekday,
    mealType: data.mealType,
    description: data.description,
    fat: data.fat,
    carbs: data.carbs,
    protein: data.protein,
    fiber: data.fiber,
    calories: data.calories,
  }
  if (data.servingSize !== undefined) entry.servingSize = data.servingSize
  if (data.quantity !== undefined) entry.quantity = data.quantity
  return entry
}

export function goalsToDoc(goals: Goals): DocumentData {
  return { ...goals }
}

/** Read goals from a doc, filling any missing macro with its default. */
export function docToGoals(data: DocumentData | undefined): Goals {
  const goals = { ...DEFAULT_GOALS }
  if (!data) return goals
  for (const key of MACRO_KEYS) {
    if (typeof data[key] === 'number') goals[key] = data[key]
  }
  return goals
}

// --- Firestore-backed implementation ----------------------------------------

/**
 * A repository backed by Cloud Firestore, scoped to one user's subtree:
 *   users/{uid}/entries/{entryId}   — one doc per food entry
 *   users/{uid}/goals/macros        — a single doc holding the macro goals
 */
export function firestoreRepo(db: Firestore, uid: string): FoodLogRepository {
  const entriesCol = collection(db, 'users', uid, 'entries')
  const goalsDoc = doc(db, 'users', uid, 'goals', 'macros')

  return {
    subscribeEntries(onChange) {
      return onSnapshot(entriesCol, (snap) => {
        onChange(snap.docs.map((d) => docToEntry(d.id, d.data())))
      })
    },
    addEntry(entry) {
      return setDoc(doc(entriesCol, entry.id), entryToDoc(entry))
    },
    deleteEntry(id) {
      return deleteDoc(doc(entriesCol, id))
    },
    subscribeGoals(onChange) {
      return onSnapshot(goalsDoc, (snap) => {
        onChange(docToGoals(snap.exists() ? snap.data() : undefined))
      })
    },
    setGoals(goals) {
      return setDoc(goalsDoc, goalsToDoc(goals))
    },
  }
}
