import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FoodsPage from './FoodsPage'
import { foodCategories } from './lib/foods'

describe('FoodsPage', () => {
  it('renders a heading for every category', () => {
    render(<FoodsPage onSelectFood={() => {}} />)
    for (const category of Object.keys(foodCategories)) {
      expect(screen.getByRole('heading', { name: category })).toBeInTheDocument()
    }
  })

  it('shows each food with its name and serving size', () => {
    render(<FoodsPage onSelectFood={() => {}} />)
    const egg = foodCategories['Dairy/Eggs'].find((f) => f.food === 'Egg')!
    const row = screen.getByRole('button', { name: egg.food })
    expect(within(row).getByText(egg.food)).toBeInTheDocument()
    expect(within(row).getByText(egg.serving_size)).toBeInTheDocument()
  })

  it('maps a clicked food to a Partial<NewFoodInput>', async () => {
    const onSelectFood = vi.fn()
    const user = userEvent.setup()
    render(<FoodsPage onSelectFood={onSelectFood} />)

    // "Egg" → protein_g 6, carbs_g 1, calories_kcal 70; fat/fiber left for the user.
    await user.click(screen.getByRole('button', { name: 'Egg' }))

    expect(onSelectFood).toHaveBeenCalledTimes(1)
    expect(onSelectFood).toHaveBeenCalledWith({
      description: 'Egg',
      servingSize: '1 large',
      protein: 6,
      carbs: 1,
      calories: 70,
    })
  })

  it('applies the "<1" sentinel rule when mapping (String cheese carbs → 1)', async () => {
    const onSelectFood = vi.fn()
    const user = userEvent.setup()
    render(<FoodsPage onSelectFood={onSelectFood} />)

    await user.click(screen.getByRole('button', { name: 'String cheese (low fat)' }))

    expect(onSelectFood).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'String cheese (low fat)', carbs: 1 }),
    )
  })
})
