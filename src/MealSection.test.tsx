import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import MealSection from './MealSection'
import type { FoodEntry, MealType } from './lib/nutrition'

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
    render(<MealSection meal="Breakfast" entries={[]} onDelete={() => {}} onEdit={() => {}} />)
    expect(screen.getByRole('heading', { name: 'Breakfast' })).toBeInTheDocument()
  })

  it('shows a friendly empty state when there are no entries', () => {
    render(<MealSection meal="Breakfast" entries={[]} onDelete={() => {}} onEdit={() => {}} />)
    expect(screen.getByText('No food logged for breakfast yet.')).toBeInTheDocument()
  })

  it('lowercases the meal name in the empty state', () => {
    render(<MealSection meal="Snacks" entries={[]} onDelete={() => {}} onEdit={() => {}} />)
    expect(screen.getByText('No food logged for snacks yet.')).toBeInTheDocument()
  })

  describe('header styling', () => {
    const colorByMeal: Record<MealType, string> = {
      Breakfast: 'text-blue-600',
      Lunch: 'text-green-600',
      Dinner: 'text-purple-600',
      Snacks: 'text-amber-600',
    }

    for (const meal of Object.keys(colorByMeal) as MealType[]) {
      it(`renders the ${meal} heading bold in its designated color`, () => {
        render(<MealSection meal={meal} entries={[]} onDelete={() => {}} onEdit={() => {}} />)
        const heading = screen.getByRole('heading', { name: meal })
        expect(heading).toHaveClass(colorByMeal[meal])
        expect(heading).toHaveClass('font-bold')
      })
    }
  })

  describe('subtotal row', () => {
    const second: FoodEntry = {
      ...entry,
      id: '2',
      description: 'Granola',
      fat: 6,
      carbs: 41,
      protein: 8,
      fiber: 4,
      calories: 280,
    }

    it('shows a subtotal row summing every macro for a non-empty section', () => {
      render(
        <MealSection meal="Breakfast" entries={[entry, second]} onDelete={() => {}} onEdit={() => {}} />,
      )
      const subtotal = screen.getByTestId('meal-subtotal')
      // Sums: calories 320+280=600, protein 22+8=30, fat 9+6=15, carbs 34+41=75, fiber 5+4=9
      expect(subtotal).toHaveTextContent('600 kcal')
      expect(subtotal).toHaveTextContent('P 30')
      expect(subtotal).toHaveTextContent('F 15')
      expect(subtotal).toHaveTextContent('C 75')
      expect(subtotal).toHaveTextContent('Fb 9')
    })

    it('does not render a subtotal row for an empty section', () => {
      render(<MealSection meal="Breakfast" entries={[]} onDelete={() => {}} onEdit={() => {}} />)
      expect(screen.queryByTestId('meal-subtotal')).not.toBeInTheDocument()
    })
  })

  it('renders a row per entry with description, calories and macros', () => {
    render(<MealSection meal="Breakfast" entries={[entry]} onDelete={() => {}} onEdit={() => {}} />)
    // Scope to the entry's own row: with a single entry the subtotal row
    // duplicates these macro values, so a document-wide query is ambiguous.
    const row = screen.getByText('Greek yogurt').closest('li') as HTMLElement
    expect(within(row).getByText('320 kcal')).toBeInTheDocument()
    expect(within(row).getByText('P 22')).toBeInTheDocument()
    expect(within(row).getByText('F 9')).toBeInTheDocument()
    expect(within(row).getByText('C 34')).toBeInTheDocument()
    expect(within(row).getByText('Fb 5')).toBeInTheDocument()
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
    render(<MealSection meal="Breakfast" entries={[scaled]} onDelete={() => {}} onEdit={() => {}} />)
    expect(screen.getByText('Egg')).toBeInTheDocument()
    expect(screen.getByText('2 × 1 large')).toBeInTheDocument()
  })

  it('shows no serving suffix for a plain entry', () => {
    render(<MealSection meal="Breakfast" entries={[entry]} onDelete={() => {}} onEdit={() => {}} />)
    expect(screen.queryByText(/×/)).not.toBeInTheDocument()
  })

  describe('delete control', () => {
    afterEach(() => vi.restoreAllMocks())

    it('deletes the entry by id once the confirmation is accepted', () => {
      const onDelete = vi.fn()
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      render(<MealSection meal="Breakfast" entries={[entry]} onDelete={onDelete} onEdit={() => {}} />)

      fireEvent.click(screen.getByRole('button', { name: 'Delete Greek yogurt' }))
      expect(window.confirm).toHaveBeenCalledOnce()
      expect(onDelete).toHaveBeenCalledWith('1')
    })

    it('does not delete when the confirmation is dismissed', () => {
      const onDelete = vi.fn()
      vi.spyOn(window, 'confirm').mockReturnValue(false)
      render(<MealSection meal="Breakfast" entries={[entry]} onDelete={onDelete} onEdit={() => {}} />)

      fireEvent.click(screen.getByRole('button', { name: 'Delete Greek yogurt' }))
      expect(onDelete).not.toHaveBeenCalled()
    })
  })

  describe('edit control', () => {
    it('calls onEdit with the entry, no confirmation needed', () => {
      const onEdit = vi.fn()
      render(<MealSection meal="Breakfast" entries={[entry]} onDelete={() => {}} onEdit={onEdit} />)

      fireEvent.click(screen.getByRole('button', { name: 'Edit Greek yogurt' }))
      expect(onEdit).toHaveBeenCalledWith(entry)
    })
  })
})
