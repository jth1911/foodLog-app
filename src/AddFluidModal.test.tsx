import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AddFluidModal from './AddFluidModal'

describe('AddFluidModal', () => {
  it('renders a drink-type dropdown, an oz field and a calories field', () => {
    render(<AddFluidModal onAdd={() => {}} onClose={() => {}} />)
    expect(screen.getByLabelText('Drink type')).toBeInTheDocument()
    expect(screen.getByLabelText('Amount (fl oz)')).toBeInTheDocument()
    expect(screen.getByLabelText('Calories')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Water' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Juice' })).toBeInTheDocument()
  })

  it('submits a parsed NewFluidInput and then closes', async () => {
    const onAdd = vi.fn()
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<AddFluidModal onAdd={onAdd} onClose={onClose} />)

    await user.selectOptions(screen.getByLabelText('Drink type'), 'Juice')
    await user.type(screen.getByLabelText('Amount (fl oz)'), '8')
    await user.type(screen.getByLabelText('Calories'), '110')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(onAdd).toHaveBeenCalledWith({ drinkType: 'Juice', oz: 8, calories: 110 })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('treats blank calories as zero', async () => {
    const onAdd = vi.fn()
    const user = userEvent.setup()
    render(<AddFluidModal onAdd={onAdd} onClose={() => {}} />)

    await user.type(screen.getByLabelText('Amount (fl oz)'), '16')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(onAdd).toHaveBeenCalledWith({ drinkType: 'Water', oz: 16, calories: 0 })
  })

  it('rejects a zero, blank or negative oz amount', async () => {
    const onAdd = vi.fn()
    const user = userEvent.setup()
    render(<AddFluidModal onAdd={onAdd} onClose={() => {}} />)

    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(onAdd).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(/amount/i)

    fireEvent.change(screen.getByLabelText('Amount (fl oz)'), { target: { value: '-3' } })
    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(onAdd).not.toHaveBeenCalled()
  })

  it('rejects negative calories', async () => {
    const onAdd = vi.fn()
    const user = userEvent.setup()
    render(<AddFluidModal onAdd={onAdd} onClose={() => {}} />)

    await user.type(screen.getByLabelText('Amount (fl oz)'), '8')
    fireEvent.change(screen.getByLabelText('Calories'), { target: { value: '-10' } })
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(onAdd).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(/calories/i)
  })

  describe('edit mode', () => {
    const drinkValues = { drinkType: 'Soda' as const, oz: 12, calories: 150 }

    it('shows an Edit title and a Save button, pre-filling the fields', () => {
      render(<AddFluidModal onAdd={() => {}} onClose={() => {}} editing initialValues={drinkValues} />)
      expect(screen.getByRole('dialog', { name: 'Edit drink' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
      expect(screen.getByLabelText('Drink type')).toHaveValue('Soda')
      expect(screen.getByLabelText('Amount (fl oz)')).toHaveValue(12)
      expect(screen.getByLabelText('Calories')).toHaveValue(150)
    })

    it('submits the edited fields', async () => {
      const onAdd = vi.fn()
      const user = userEvent.setup()
      render(<AddFluidModal onAdd={onAdd} onClose={() => {}} editing initialValues={drinkValues} />)

      fireEvent.change(screen.getByLabelText('Amount (fl oz)'), { target: { value: '20' } })
      await user.click(screen.getByRole('button', { name: 'Save' }))

      expect(onAdd).toHaveBeenCalledWith({ drinkType: 'Soda', oz: 20, calories: 150 })
    })
  })

  it('closes on backdrop click and Escape without adding', () => {
    const onAdd = vi.fn()
    const onClose = vi.fn()
    render(<AddFluidModal onAdd={onAdd} onClose={onClose} />)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('presentation'))
    expect(onClose).toHaveBeenCalledTimes(2)
    expect(onAdd).not.toHaveBeenCalled()
  })
})
