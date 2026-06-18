import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import FluidSection from './FluidSection'
import { type FluidEntry } from './lib/fluid'

const drinks: FluidEntry[] = [
  { id: 'd1', date: '2026-06-17', week: 25, weekday: 'Wednesday', drinkType: 'Water', oz: 16, calories: 0 },
  { id: 'd2', date: '2026-06-17', week: 25, weekday: 'Wednesday', drinkType: 'Juice', oz: 8, calories: 110 },
]

const renderSection = (over: Partial<Parameters<typeof FluidSection>[0]> = {}) =>
  render(
    <FluidSection
      fluids={drinks}
      date="2026-06-17"
      targetFluid={64}
      onEdit={() => {}}
      onDelete={() => {}}
      {...over}
    />,
  )

describe('FluidSection', () => {
  afterEach(() => vi.restoreAllMocks())

  it('lists each drink with its volume and calories', () => {
    renderSection()
    expect(screen.getByText('Water')).toBeInTheDocument()
    expect(screen.getByText('Juice')).toBeInTheDocument()
    expect(screen.getByText('110 kcal')).toBeInTheDocument()
  })

  it('shows the running oz total against the target', () => {
    renderSection()
    expect(screen.getByLabelText('Fluid total')).toHaveTextContent('24')
    expect(screen.getByLabelText('Fluid total').closest('p')!).toHaveTextContent('/ 64 fl oz')
  })

  it('omits the target from the total when none is set', () => {
    renderSection({ targetFluid: null })
    expect(screen.getByLabelText('Fluid total').closest('p')!).not.toHaveTextContent('/')
  })

  it('reads the total in red while under the target', () => {
    // 24 oz logged against a 95 oz goal → under.
    renderSection({ targetFluid: 95 })
    expect(screen.getByLabelText('Fluid total')).toHaveClass('text-rose-600')
  })

  it('reads the total in green once the target is met', () => {
    // 24 oz logged against a 20 oz goal → met.
    renderSection({ targetFluid: 20 })
    expect(screen.getByLabelText('Fluid total')).toHaveClass('text-emerald-600')
  })

  it('shows an empty state with no drinks', () => {
    renderSection({ fluids: [] })
    expect(screen.getByText(/no drinks logged for this day yet/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Fluid total')).toHaveTextContent('0')
  })

  it('edits a drink', () => {
    const onEdit = vi.fn()
    renderSection({ onEdit })
    fireEvent.click(screen.getByRole('button', { name: 'Edit Juice 8 fl oz' }))
    expect(onEdit).toHaveBeenCalledWith(drinks[1])
  })

  it('deletes a drink only after confirmation', () => {
    const onDelete = vi.fn()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    renderSection({ onDelete })

    fireEvent.click(screen.getByRole('button', { name: 'Delete Water 16 fl oz' }))
    expect(onDelete).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Delete Water 16 fl oz' }))
    expect(onDelete).toHaveBeenCalledWith('d1')
    expect(confirm).toHaveBeenCalledTimes(2)
  })
})
