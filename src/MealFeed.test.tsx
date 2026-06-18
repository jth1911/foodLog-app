import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import MealFeed from './MealFeed'
import type { FoodEntry } from './lib/nutrition'

const make = (over: Partial<FoodEntry>): FoodEntry => ({
  id: over.id ?? 'x',
  date: over.date ?? '2026-06-17',
  week: over.week ?? 25,
  weekday: over.weekday ?? 'Wednesday',
  mealType: over.mealType ?? 'Breakfast',
  description: over.description ?? 'food',
  fat: over.fat ?? 0,
  carbs: over.carbs ?? 0,
  protein: over.protein ?? 0,
  fiber: over.fiber ?? 0,
  calories: over.calories ?? 0,
})

describe('MealFeed', () => {
  it('renders all four meal sections in order within the Food log region', () => {
    render(<MealFeed loggedFoods={[]} onDelete={() => {}} onEdit={() => {}} />)
    const region = screen.getByRole('region', { name: 'Food log' })
    const headings = within(region)
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent)
    expect(headings).toEqual(['Breakfast', 'Lunch', 'Dinner', 'Snacks'])
  })

  it('routes each entry to its meal section', () => {
    const foods = [
      make({ id: '1', mealType: 'Lunch', description: 'Chicken salad' }),
      make({ id: '2', mealType: 'Snacks', description: 'Almonds' }),
    ]
    render(<MealFeed loggedFoods={foods} onDelete={() => {}} onEdit={() => {}} />)
    expect(screen.getByText('Chicken salad')).toBeInTheDocument()
    expect(screen.getByText('Almonds')).toBeInTheDocument()
  })

  it('shows empty placeholders for meals with no entries', () => {
    render(<MealFeed loggedFoods={[make({ mealType: 'Breakfast' })]} onDelete={() => {}} onEdit={() => {}} />)
    expect(screen.getByText('No food logged for lunch yet.')).toBeInTheDocument()
    expect(screen.getByText('No food logged for dinner yet.')).toBeInTheDocument()
    expect(screen.getByText('No food logged for snacks yet.')).toBeInTheDocument()
  })
})
