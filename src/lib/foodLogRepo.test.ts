import { describe, expect, it } from 'vitest'
import { docToEntry, docToGoals, entryToDoc, goalsToDoc } from './foodLogRepo'
import { DEFAULT_GOALS, type FoodEntry, type Goals } from './nutrition'

const baseEntry: FoodEntry = {
  id: 'abc',
  date: '2026-05-01',
  week: 18,
  weekday: 'Friday',
  mealType: 'Lunch',
  description: 'Grilled chicken salad',
  fat: 18,
  carbs: 20,
  protein: 43,
  fiber: 7,
  calories: 430,
}

describe('entryToDoc', () => {
  it('drops the id (the doc id holds it) and keeps every macro field', () => {
    const doc = entryToDoc(baseEntry)
    expect(doc).not.toHaveProperty('id')
    expect(doc).toMatchObject({
      date: '2026-05-01',
      week: 18,
      weekday: 'Friday',
      mealType: 'Lunch',
      description: 'Grilled chicken salad',
      fat: 18,
      carbs: 20,
      protein: 43,
      fiber: 7,
      calories: 430,
    })
  })

  it('omits absent optional fields rather than writing undefined (Firestore rejects undefined)', () => {
    const doc = entryToDoc(baseEntry)
    expect('servingSize' in doc).toBe(false)
    expect('quantity' in doc).toBe(false)
  })

  it('includes servingSize/quantity when present', () => {
    const doc = entryToDoc({ ...baseEntry, servingSize: '1 large', quantity: 2 })
    expect(doc).toMatchObject({ servingSize: '1 large', quantity: 2 })
  })
})

describe('docToEntry', () => {
  it('round-trips an entry through the doc form', () => {
    const back = docToEntry(baseEntry.id, entryToDoc(baseEntry))
    expect(back).toEqual(baseEntry)
  })

  it('round-trips a quantity-scaled entry', () => {
    const scaled: FoodEntry = { ...baseEntry, servingSize: '1 large', quantity: 2 }
    expect(docToEntry(scaled.id, entryToDoc(scaled))).toEqual(scaled)
  })

  it('uses the passed id, not anything in the doc', () => {
    expect(docToEntry('xyz', entryToDoc(baseEntry)).id).toBe('xyz')
  })
})

describe('goals mappers', () => {
  it('round-trips goals', () => {
    const goals: Goals = { calories: 2100, protein: 130, fat: 70, carbs: 140, fiber: 35 }
    expect(docToGoals(goalsToDoc(goals))).toEqual(goals)
  })

  it('falls back to defaults for a missing/partial doc', () => {
    expect(docToGoals(undefined)).toEqual(DEFAULT_GOALS)
    expect(docToGoals({ protein: 200 })).toEqual({ ...DEFAULT_GOALS, protein: 200 })
  })
})
