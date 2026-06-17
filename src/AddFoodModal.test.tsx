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
