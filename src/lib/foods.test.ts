import { describe, it, expect } from 'vitest'
import { foodCategories, normaliseMacro, type FoodReference } from './foods'

describe('normaliseMacro', () => {
  it('parses plain integers and decimals', () => {
    expect(normaliseMacro('24')).toBe(24)
    expect(normaliseMacro('3.5')).toBe(3.5)
    expect(normaliseMacro('0')).toBe(0)
  })

  it('rounds the "<1" sentinel up to 1', () => {
    expect(normaliseMacro('<1')).toBe(1)
  })

  it('takes the lower bound of a range', () => {
    expect(normaliseMacro('100-110')).toBe(100)
    expect(normaliseMacro('20-35')).toBe(20)
    expect(normaliseMacro('0-1')).toBe(0)
    expect(normaliseMacro('18-22')).toBe(18)
  })

  it('falls back to 0 for blank or unparseable input', () => {
    expect(normaliseMacro('')).toBe(0)
    expect(normaliseMacro('   ')).toBe(0)
    expect(normaliseMacro('n/a')).toBe(0)
  })
})

describe('foodCategories', () => {
  it('exposes every category as a non-empty array of food references', () => {
    const keys = Object.keys(foodCategories)
    expect(keys).toEqual(
      expect.arrayContaining([
        'Dairy/Eggs',
        'Meat/Poultry',
        'Seafood',
        'Vegetables',
        'Legumes',
        'Nuts/Seeds',
        'Other',
      ]),
    )
    for (const list of Object.values(foodCategories)) {
      expect(Array.isArray(list)).toBe(true)
      expect(list.length).toBeGreaterThan(0)
    }
  })

  it('gives each entry a food name and serving size', () => {
    const all: FoodReference[] = Object.values(foodCategories).flat()
    for (const food of all) {
      expect(typeof food.food).toBe('string')
      expect(food.food.length).toBeGreaterThan(0)
      expect(typeof food.serving_size).toBe('string')
    }
  })
})
