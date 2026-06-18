import { useState } from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FoodsPage from './FoodsPage'
import { type UserFoodReference } from './lib/foods'

// The Gemini client is mocked: estimateMacros/isGeminiConfigured are controlled
// per test, while the pure mergeEmptyMacros keeps its real (tested) behaviour.
const { estimateMacros, isGeminiConfigured } = vi.hoisted(() => ({
  estimateMacros: vi.fn(),
  isGeminiConfigured: vi.fn(() => true),
}))
vi.mock('./lib/gemini', async () => {
  const actual = await vi.importActual<typeof import('./lib/gemini')>('./lib/gemini')
  return { ...actual, estimateMacros, isGeminiConfigured }
})

const foods: Record<string, UserFoodReference[]> = {
  'Dairy/Eggs': [
    { id: 'e1', food: 'Egg', serving_size: '1 large', protein: 6, carbs: 1, calories: 70 },
    { id: 'e2', food: 'String cheese', serving_size: '1 stick', protein: 6, carbs: 1, calories: 60 },
  ],
  Empty: [],
}

const noop = () => {}

function renderPage(overrides: Partial<Parameters<typeof FoodsPage>[0]> = {}) {
  const props = {
    foods,
    onSelectFood: noop,
    addFood: noop,
    updateFood: noop,
    deleteFood: noop,
    addCategory: noop,
    deleteCategory: noop,
    ...overrides,
  }
  render(<FoodsPage {...props} />)
  return props
}

describe('FoodsPage', () => {
  afterEach(() => vi.restoreAllMocks())

  it('renders a heading for every category', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: 'Dairy/Eggs' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Empty' })).toBeInTheDocument()
  })

  it('shows each food with its name, serving size and macros', () => {
    renderPage()
    const row = screen.getByRole('button', { name: 'Egg' })
    expect(within(row).getByText('Egg')).toBeInTheDocument()
    expect(within(row).getByText('1 large')).toBeInTheDocument()
    expect(within(row).getByText('6g')).toBeInTheDocument()
  })

  it('maps a clicked food to a Partial<NewFoodInput> with numeric macros', async () => {
    const onSelectFood = vi.fn()
    const user = userEvent.setup()
    renderPage({ onSelectFood })

    await user.click(screen.getByRole('button', { name: 'Egg' }))
    expect(onSelectFood).toHaveBeenCalledWith({
      description: 'Egg',
      servingSize: '1 large',
      protein: 6,
      carbs: 1,
      calories: 70,
    })
  })

  it('passes optional fat/fiber through when the food carries them', async () => {
    const onSelectFood = vi.fn()
    const user = userEvent.setup()
    renderPage({
      foods: {
        Custom: [
          { id: 'b1', food: 'Bar', serving_size: '1 bar', protein: 20, carbs: 25, calories: 210, fat: 7, fiber: 3 },
        ],
      },
      onSelectFood,
    })

    await user.click(screen.getByRole('button', { name: 'Bar' }))
    expect(onSelectFood).toHaveBeenCalledWith(expect.objectContaining({ fat: 7, fiber: 3 }))
  })

  it('adds a new category via the form', async () => {
    const addCategory = vi.fn()
    const user = userEvent.setup()
    renderPage({ addCategory })

    await user.type(screen.getByLabelText('New category name'), 'Snacks')
    await user.click(screen.getByRole('button', { name: 'Add category' }))
    expect(addCategory).toHaveBeenCalledWith('Snacks')
  })

  it('rejects a duplicate category name', async () => {
    const addCategory = vi.fn()
    const user = userEvent.setup()
    renderPage({ addCategory })

    await user.type(screen.getByLabelText('New category name'), 'Dairy/Eggs')
    await user.click(screen.getByRole('button', { name: 'Add category' }))
    expect(addCategory).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(/already exists/i)
  })

  it('adds a food to the selected category', async () => {
    const addFood = vi.fn()
    const user = userEvent.setup()
    renderPage({ addFood })

    await user.selectOptions(screen.getByLabelText('Food category'), 'Empty')
    await user.type(screen.getByLabelText('New food name'), 'Tofu')
    await user.type(screen.getByLabelText('New food serving size'), '1/2 cup')
    await user.type(screen.getByLabelText('New food protein'), '10')
    await user.type(screen.getByLabelText('New food carbs'), '2')
    await user.type(screen.getByLabelText('New food calories'), '80')
    await user.click(screen.getByRole('button', { name: 'Add food' }))

    expect(addFood).toHaveBeenCalledWith('Empty', {
      food: 'Tofu',
      serving_size: '1/2 cup',
      protein: 10,
      carbs: 2,
      calories: 80,
    })
  })

  it('includes optional fat/fiber on add only when entered', async () => {
    const addFood = vi.fn()
    const user = userEvent.setup()
    renderPage({ addFood })

    await user.type(screen.getByLabelText('New food name'), 'Peanut butter')
    await user.type(screen.getByLabelText('New food serving size'), '1 tbsp')
    await user.type(screen.getByLabelText('New food protein'), '4')
    await user.type(screen.getByLabelText('New food carbs'), '3')
    await user.type(screen.getByLabelText('New food calories'), '94')
    await user.type(screen.getByLabelText('New food fat'), '8')
    await user.click(screen.getByRole('button', { name: 'Add food' }))

    expect(addFood).toHaveBeenCalledWith('Dairy/Eggs', expect.objectContaining({ fat: 8 }))
    expect(addFood.mock.calls[0][1]).not.toHaveProperty('fiber')
  })

  it('rejects a food with a missing required macro', async () => {
    const addFood = vi.fn()
    const user = userEvent.setup()
    renderPage({ addFood })

    await user.type(screen.getByLabelText('New food name'), 'Mystery')
    await user.type(screen.getByLabelText('New food serving size'), '1')
    // protein left blank
    await user.click(screen.getByRole('button', { name: 'Add food' }))
    expect(addFood).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(/protein/i)
  })

  it('edits a food in place, keeping its id and category', async () => {
    const updateFood = vi.fn()
    const user = userEvent.setup()
    renderPage({ updateFood })

    await user.click(screen.getByRole('button', { name: 'Edit Egg' }))
    // The form pre-fills and locks the category.
    expect(screen.getByLabelText('New food name')).toHaveValue('Egg')
    expect(screen.getByLabelText('Food category')).toHaveTextContent('Dairy/Eggs')

    await user.clear(screen.getByLabelText('New food protein'))
    await user.type(screen.getByLabelText('New food protein'), '7')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(updateFood).toHaveBeenCalledWith('Dairy/Eggs', {
      id: 'e1',
      food: 'Egg',
      serving_size: '1 large',
      protein: 7,
      carbs: 1,
      calories: 70,
    })
  })

  it('focuses the name field when editing, bringing the form into view', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: 'Edit Egg' }))
    expect(screen.getByLabelText('New food name')).toHaveFocus()
  })

  it('confirms before deleting a single food', async () => {
    const deleteFood = vi.fn()
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()
    renderPage({ deleteFood })

    await user.click(screen.getByRole('button', { name: 'Delete Egg' }))
    expect(window.confirm).toHaveBeenCalledOnce()
    expect(deleteFood).not.toHaveBeenCalled()

    vi.mocked(window.confirm).mockReturnValue(true)
    await user.click(screen.getByRole('button', { name: 'Delete Egg' }))
    expect(deleteFood).toHaveBeenCalledWith('Dairy/Eggs', 'e1')
  })

  it('deletes an empty category without confirmation', async () => {
    const deleteCategory = vi.fn()
    const confirm = vi.spyOn(window, 'confirm')
    const user = userEvent.setup()
    renderPage({ deleteCategory })

    await user.click(screen.getByRole('button', { name: 'Delete category Empty' }))
    expect(confirm).not.toHaveBeenCalled()
    expect(deleteCategory).toHaveBeenCalledWith('Empty')
  })

  it('does not re-add a category that was the chosen add-target after deleting it', async () => {
    const addFood = vi.fn()
    const user = userEvent.setup()
    // A stateful host so deleting a category actually updates the foods prop,
    // mirroring the real store wiring (a static prop wouldn't exercise the fix).
    function Host() {
      const [data, setData] = useState<Record<string, UserFoodReference[]>>({ Empty: [], Other: [] })
      return (
        <FoodsPage
          foods={data}
          onSelectFood={noop}
          addFood={addFood}
          updateFood={noop}
          deleteFood={noop}
          addCategory={noop}
          deleteCategory={(name) =>
            setData((prev) => {
              const next = { ...prev }
              delete next[name]
              return next
            })
          }
        />
      )
    }
    render(<Host />)

    // Point the add-target at "Empty", then delete "Empty".
    await user.selectOptions(screen.getByLabelText('Food category'), 'Empty')
    await user.click(screen.getByRole('button', { name: 'Delete category Empty' }))

    // Adding a food now falls back to a still-existing category, not the gone one.
    await user.type(screen.getByLabelText('New food name'), 'Tofu')
    await user.type(screen.getByLabelText('New food serving size'), '1/2 cup')
    await user.type(screen.getByLabelText('New food protein'), '10')
    await user.type(screen.getByLabelText('New food carbs'), '2')
    await user.type(screen.getByLabelText('New food calories'), '80')
    await user.click(screen.getByRole('button', { name: 'Add food' }))

    expect(addFood).toHaveBeenCalledTimes(1)
    expect(addFood.mock.calls[0][0]).toBe('Other')
  })

  it('confirms before deleting a non-empty category', async () => {
    const deleteCategory = vi.fn()
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()
    renderPage({ deleteCategory })

    await user.click(screen.getByRole('button', { name: 'Delete category Dairy/Eggs' }))
    expect(window.confirm).toHaveBeenCalledOnce()
    expect(deleteCategory).not.toHaveBeenCalled()

    vi.mocked(window.confirm).mockReturnValue(true)
    await user.click(screen.getByRole('button', { name: 'Delete category Dairy/Eggs' }))
    expect(deleteCategory).toHaveBeenCalledWith('Dairy/Eggs')
  })

  describe('auto-fill missing macros', () => {
    const autofill = () => screen.getByRole('button', { name: /auto-fill missing macros/i })

    afterEach(() => {
      estimateMacros.mockReset()
      isGeminiConfigured.mockReturnValue(true)
    })

    it('is hidden when no API key is configured', () => {
      isGeminiConfigured.mockReturnValue(false)
      renderPage()
      expect(screen.queryByRole('button', { name: /auto-fill missing macros/i })).toBeNull()
    })

    it('is disabled until both food name and serving size are filled', async () => {
      const user = userEvent.setup()
      renderPage()
      expect(autofill()).toBeDisabled()

      await user.type(screen.getByLabelText('New food name'), 'Banana')
      expect(autofill()).toBeDisabled()
      await user.type(screen.getByLabelText('New food serving size'), '1 medium')
      expect(autofill()).toBeEnabled()
    })

    it('fills only the empty macro fields, leaving entered values untouched', async () => {
      estimateMacros.mockResolvedValue({ protein: 1.3, carbs: 27, calories: 105, fat: 0.4, fiber: 3 })
      const user = userEvent.setup()
      renderPage()

      await user.type(screen.getByLabelText('New food name'), 'Banana')
      await user.type(screen.getByLabelText('New food serving size'), '1 medium')
      await user.type(screen.getByLabelText('New food protein'), '2') // user-entered: must be kept
      await user.click(autofill())

      expect(estimateMacros).toHaveBeenCalledWith({ food: 'Banana', serving_size: '1 medium' })
      expect(await screen.findByLabelText('New food carbs')).toHaveValue(27)
      expect(screen.getByLabelText('New food calories')).toHaveValue(105)
      expect(screen.getByLabelText('New food fat')).toHaveValue(0.4)
      expect(screen.getByLabelText('New food fiber')).toHaveValue(3)
      expect(screen.getByLabelText('New food protein')).toHaveValue(2) // untouched
    })

    it('surfaces an error inline and leaves manual entry working', async () => {
      estimateMacros.mockRejectedValue(new Error('quota exceeded'))
      const user = userEvent.setup()
      renderPage()

      await user.type(screen.getByLabelText('New food name'), 'Banana')
      await user.type(screen.getByLabelText('New food serving size'), '1 medium')
      await user.click(autofill())

      expect(await screen.findByRole('alert')).toHaveTextContent(/quota exceeded/i)
      // Fields stay empty and editable.
      const carbs = screen.getByLabelText('New food carbs')
      expect(carbs).toHaveValue(null)
      await user.type(carbs, '27')
      expect(carbs).toHaveValue(27)
    })
  })
})
