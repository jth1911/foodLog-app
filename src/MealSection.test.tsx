import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import MealSection from './MealSection'
import type { FoodEntry } from './lib/nutrition'

const entry: FoodEntry = {
  id: '1',
  date: '2026-06-17',
  week: 25,
  weekday: 'Wednesday',
  mealType: 'Breakfast',
  description: 'Greek yogurt',
  fat: 9,
  carbs: 34,
  protein: 22,
  fiber: 5,
  calories: 320,
}

describe('MealSection', () => {
  it('renders the meal name as a heading', () => {
    render(<MealSection meal="Breakfast" entries={[]} />)
    expect(screen.getByRole('heading', { name: 'Breakfast' })).toBeInTheDocument()
  })

  it('shows a friendly empty state when there are no entries', () => {
    render(<MealSection meal="Breakfast" entries={[]} />)
    expect(screen.getByText('No food logged for breakfast yet.')).toBeInTheDocument()
  })

  it('lowercases the meal name in the empty state', () => {
    render(<MealSection meal="Snacks" entries={[]} />)
    expect(screen.getByText('No food logged for snacks yet.')).toBeInTheDocument()
  })

  it('renders a row per entry with description, calories and macros', () => {
    render(<MealSection meal="Breakfast" entries={[entry]} />)
    expect(screen.getByText('Greek yogurt')).toBeInTheDocument()
    expect(screen.getByText('320 kcal')).toBeInTheDocument()
    expect(screen.getByText('P 22')).toBeInTheDocument()
    expect(screen.getByText('F 9')).toBeInTheDocument()
    expect(screen.getByText('C 34')).toBeInTheDocument()
    expect(screen.getByText('Fb 5')).toBeInTheDocument()
    // empty-state copy should NOT be present when there are entries
    expect(screen.queryByText(/No food logged/)).not.toBeInTheDocument()
  })
})
