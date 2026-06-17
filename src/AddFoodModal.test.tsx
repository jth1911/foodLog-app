import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AddFoodModal from './AddFoodModal'

describe('AddFoodModal', () => {
  it('renders all macro inputs and a meal-type dropdown', () => {
    render(<AddFoodModal onAdd={() => {}} onClose={() => {}} />)
    expect(screen.getByLabelText('Food name')).toBeInTheDocument()
    expect(screen.getByLabelText('Calories')).toBeInTheDocument()
    expect(screen.getByLabelText('Protein')).toBeInTheDocument()
    expect(screen.getByLabelText('Carbs')).toBeInTheDocument()
    expect(screen.getByLabelText('Fat')).toBeInTheDocument()
    expect(screen.getByLabelText('Fiber')).toBeInTheDocument()

    const meal = screen.getByLabelText('Meal type')
    expect(meal).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Breakfast' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Snacks' })).toBeInTheDocument()
  })

  it('submits a parsed NewFoodInput and then closes', async () => {
    const onAdd = vi.fn()
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<AddFoodModal onAdd={onAdd} onClose={onClose} />)

    await user.type(screen.getByLabelText('Food name'), 'Apple')
    await user.selectOptions(screen.getByLabelText('Meal type'), 'Lunch')
    await user.type(screen.getByLabelText('Calories'), '95')
    await user.type(screen.getByLabelText('Protein'), '0.5')
    await user.type(screen.getByLabelText('Carbs'), '25')
    await user.type(screen.getByLabelText('Fiber'), '4')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(onAdd).toHaveBeenCalledTimes(1)
    expect(onAdd).toHaveBeenCalledWith({
      description: 'Apple',
      mealType: 'Lunch',
      calories: 95,
      protein: 0.5,
      fat: 0, // left blank → 0
      carbs: 25,
      fiber: 4,
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('rejects an empty food name', async () => {
    const onAdd = vi.fn()
    const user = userEvent.setup()
    render(<AddFoodModal onAdd={onAdd} onClose={() => {}} />)

    await user.type(screen.getByLabelText('Calories'), '100')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(onAdd).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(/food name/i)
  })

  it('rejects a negative macro value', async () => {
    const onAdd = vi.fn()
    const user = userEvent.setup()
    render(<AddFoodModal onAdd={onAdd} onClose={() => {}} />)

    await user.type(screen.getByLabelText('Food name'), 'Bad entry')
    // type="number" can't hold a leading '-' via keystrokes; set it directly.
    fireEvent.change(screen.getByLabelText('Protein'), { target: { value: '-5' } })
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(onAdd).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(/protein/i)
  })

  it('pre-fills from initialValues and submits the (edited) entry', async () => {
    const onAdd = vi.fn()
    const user = userEvent.setup()
    render(
      <AddFoodModal
        onAdd={onAdd}
        onClose={() => {}}
        initialValues={{ description: 'Egg', mealType: 'Lunch', protein: 6, carbs: 1, calories: 70 }}
      />,
    )

    // Provided fields are pre-filled; absent fields (fat/fiber) stay blank.
    expect(screen.getByLabelText('Food name')).toHaveValue('Egg')
    expect(screen.getByLabelText('Meal type')).toHaveValue('Lunch')
    expect(screen.getByLabelText('Calories')).toHaveValue(70)
    expect(screen.getByLabelText('Protein')).toHaveValue(6)
    expect(screen.getByLabelText('Carbs')).toHaveValue(1)
    expect(screen.getByLabelText('Fat')).toHaveValue(null)
    expect(screen.getByLabelText('Fiber')).toHaveValue(null)

    // The user can adjust before submitting.
    await user.type(screen.getByLabelText('Fat'), '5')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(onAdd).toHaveBeenCalledWith({
      description: 'Egg',
      mealType: 'Lunch',
      calories: 70,
      protein: 6,
      fat: 5,
      carbs: 1,
      fiber: 0,
    })
  })

  describe('quantity scaling (pre-filled foods)', () => {
    const eggValues = {
      description: 'Egg',
      mealType: 'Breakfast' as const,
      servingSize: '1 large',
      protein: 6,
      carbs: 1,
      calories: 70,
    }

    it('shows no quantity field on a blank FAB open', () => {
      render(<AddFoodModal onAdd={() => {}} onClose={() => {}} />)
      expect(screen.queryByLabelText('Quantity')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Serving size')).not.toBeInTheDocument()
    })

    it('shows the read-only serving and a quantity field when pre-filled with a serving', () => {
      render(<AddFoodModal onAdd={() => {}} onClose={() => {}} initialValues={eggValues} />)
      expect(screen.getByLabelText('Serving size')).toHaveTextContent('1 large')
      expect(screen.getByLabelText('Quantity')).toHaveValue(1)
    })

    it('submits per-serving macros unchanged at the default quantity of 1', async () => {
      const onAdd = vi.fn()
      const user = userEvent.setup()
      render(<AddFoodModal onAdd={onAdd} onClose={() => {}} initialValues={eggValues} />)

      await user.click(screen.getByRole('button', { name: 'Add' }))

      expect(onAdd).toHaveBeenCalledWith({
        description: 'Egg',
        mealType: 'Breakfast',
        calories: 70,
        protein: 6,
        fat: 0,
        carbs: 1,
        fiber: 0,
        servingSize: '1 large',
        quantity: 1,
      })
    })

    it('doubles the macros and records quantity 2', async () => {
      const onAdd = vi.fn()
      const user = userEvent.setup()
      render(<AddFoodModal onAdd={onAdd} onClose={() => {}} initialValues={eggValues} />)

      fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '2' } })
      await user.click(screen.getByRole('button', { name: 'Add' }))

      expect(onAdd).toHaveBeenCalledWith(
        expect.objectContaining({ calories: 140, protein: 12, carbs: 2, quantity: 2 }),
      )
    })

    it('halves the macros for a partial serving, keeping non-integers', async () => {
      const onAdd = vi.fn()
      const user = userEvent.setup()
      render(<AddFoodModal onAdd={onAdd} onClose={() => {}} initialValues={eggValues} />)

      // Add per-serving fat so the 0.5 × 5 = 2.5 non-integer case is exercised.
      await user.type(screen.getByLabelText('Fat'), '5')
      fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '0.5' } })
      await user.click(screen.getByRole('button', { name: 'Add' }))

      expect(onAdd).toHaveBeenCalledWith(
        expect.objectContaining({ calories: 35, protein: 3, fat: 2.5, carbs: 0.5, quantity: 0.5 }),
      )
    })

    it('shows a live preview of the scaled totals', async () => {
      render(<AddFoodModal onAdd={() => {}} onClose={() => {}} initialValues={eggValues} />)

      const preview = screen.getByLabelText('Scaled totals')
      expect(preview).toHaveTextContent('70 kcal')

      fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '3' } })
      expect(preview).toHaveTextContent('210 kcal')
      expect(preview).toHaveTextContent('18 g')
    })

    it('rejects a zero or negative quantity', async () => {
      const onAdd = vi.fn()
      const user = userEvent.setup()
      render(<AddFoodModal onAdd={onAdd} onClose={() => {}} initialValues={eggValues} />)

      fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '0' } })
      await user.click(screen.getByRole('button', { name: 'Add' }))

      expect(onAdd).not.toHaveBeenCalled()
      expect(screen.getByRole('alert')).toHaveTextContent(/quantity/i)
    })
  })

  it('cancels without adding', async () => {
    const onAdd = vi.fn()
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<AddFoodModal onAdd={onAdd} onClose={onClose} />)

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onAdd).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on backdrop click and Escape without adding', () => {
    const onAdd = vi.fn()
    const onClose = vi.fn()
    render(<AddFoodModal onAdd={onAdd} onClose={onClose} />)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)

    // The backdrop is the presentation wrapper around the dialog.
    fireEvent.click(screen.getByRole('presentation'))
    expect(onClose).toHaveBeenCalledTimes(2)
    expect(onAdd).not.toHaveBeenCalled()
  })
})
