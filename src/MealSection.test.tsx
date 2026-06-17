import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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
    render(<MealSection meal="Breakfast" entries={[]} onDelete={() => {}} />)
    expect(screen.getByRole('heading', { name: 'Breakfast' })).toBeInTheDocument()
  })

  it('shows a friendly empty state when there are no entries', () => {
    render(<MealSection meal="Breakfast" entries={[]} onDelete={() => {}} />)
    expect(screen.getByText('No food logged for breakfast yet.')).toBeInTheDocument()
  })

  it('lowercases the meal name in the empty state', () => {
    render(<MealSection meal="Snacks" entries={[]} onDelete={() => {}} />)
    expect(screen.getByText('No food logged for snacks yet.')).toBeInTheDocument()
  })

  it('renders a row per entry with description, calories and macros', () => {
    render(<MealSection meal="Breakfast" entries={[entry]} onDelete={() => {}} />)
    expect(screen.getByText('Greek yogurt')).toBeInTheDocument()
    expect(screen.getByText('320 kcal')).toBeInTheDocument()
    expect(screen.getByText('P 22')).toBeInTheDocument()
    expect(screen.getByText('F 9')).toBeInTheDocument()
    expect(screen.getByText('C 34')).toBeInTheDocument()
    expect(screen.getByText('Fb 5')).toBeInTheDocument()
    // empty-state copy should NOT be present when there are entries
    expect(screen.queryByText(/No food logged/)).not.toBeInTheDocument()
  })

  it('shows the serving and quantity for a scaled reference entry', () => {
    const scaled: FoodEntry = {
      ...entry,
      id: '2',
      description: 'Egg',
      servingSize: '1 large',
      quantity: 2,
    }
    render(<MealSection meal="Breakfast" entries={[scaled]} onDelete={() => {}} />)
    expect(screen.getByText('Egg')).toBeInTheDocument()
    expect(screen.getByText('2 × 1 large')).toBeInTheDocument()
  })

  it('shows no serving suffix for a plain entry', () => {
    render(<MealSection meal="Breakfast" entries={[entry]} onDelete={() => {}} />)
    expect(screen.queryByText(/×/)).not.toBeInTheDocument()
  })

  describe('delete control', () => {
    afterEach(() => vi.restoreAllMocks())

    it('deletes the entry by id once the confirmation is accepted', () => {
      const onDelete = vi.fn()
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      render(<MealSection meal="Breakfast" entries={[entry]} onDelete={onDelete} />)

      fireEvent.click(screen.getByRole('button', { name: 'Delete Greek yogurt' }))
      expect(window.confirm).toHaveBeenCalledOnce()
      expect(onDelete).toHaveBeenCalledWith('1')
    })

    it('does not delete when the confirmation is dismissed', () => {
      const onDelete = vi.fn()
      vi.spyOn(window, 'confirm').mockReturnValue(false)
      render(<MealSection meal="Breakfast" entries={[entry]} onDelete={onDelete} />)

      fireEvent.click(screen.getByRole('button', { name: 'Delete Greek yogurt' }))
      expect(onDelete).not.toHaveBeenCalled()
    })
  })
})
