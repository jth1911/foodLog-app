import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import Dashboard from './Dashboard'

describe('Dashboard', () => {
  it('renders the heading and summary card', () => {
    render(<Dashboard />)
    expect(screen.getByRole('heading', { name: 'Food Log' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Daily summary' })).toBeInTheDocument()
  })

  it('shows totals computed from the seeded entries', () => {
    render(<Dashboard />)
    // protein: 22 + 0 + 43 + 40 + 2 = 107
    expect(screen.getByLabelText('Protein consumed')).toHaveTextContent('107')
    // calories: 320 + 5 + 430 + 560 + 120 = 1435
    expect(screen.getByLabelText('Calories consumed')).toHaveTextContent('1435')
  })

  it('reflects goal edits immediately in the summary status colour', () => {
    render(<Dashboard />)
    const proteinValue = screen.getByLabelText('Protein consumed').closest('dd')!
    // 107 consumed < 120 goal → unmet
    expect(proteinValue.className).toContain('rose')

    fireEvent.change(screen.getByLabelText('Protein goal'), { target: { value: '100' } })
    // 107 consumed ≥ 100 goal → met
    expect(proteinValue.className).toContain('emerald')
    expect(proteinValue).toHaveTextContent('/ 100')
  })

  it('groups food entries under the correct meal headings', () => {
    render(<Dashboard />)
    const log = screen.getByRole('region', { name: 'Food log' })
    expect(within(log).getByRole('heading', { name: 'Breakfast' })).toBeInTheDocument()
    expect(within(log).getByRole('heading', { name: 'Lunch' })).toBeInTheDocument()
    expect(within(log).getByRole('heading', { name: 'Dinner' })).toBeInTheDocument()
    expect(within(log).getByText('Grilled chicken salad')).toBeInTheDocument()
    expect(within(log).getByText('Salmon, quinoa & broccoli')).toBeInTheDocument()
  })

  it('renders a date control initialised to the seed date', () => {
    render(<Dashboard />)
    const dateInput = screen.getByLabelText('Selected date') as HTMLInputElement
    expect(dateInput.value).toBe('2026-06-17')
    expect(screen.getByRole('button', { name: 'Previous day' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next day' })).toBeInTheDocument()
  })

  it('shows zero totals and empty meal states for a day with no entries', () => {
    render(<Dashboard />)
    fireEvent.change(screen.getByLabelText('Selected date'), {
      target: { value: '2026-06-18' },
    })
    expect(screen.getByLabelText('Calories consumed')).toHaveTextContent('0')
    expect(screen.getByLabelText('Protein consumed')).toHaveTextContent('0')

    const log = screen.getByRole('region', { name: 'Food log' })
    expect(within(log).queryByText('Grilled chicken salad')).not.toBeInTheDocument()
    expect(within(log).getByText(/no food logged for breakfast yet/i)).toBeInTheDocument()
  })

  it('steps the date forward and back one day, keeping summary and feed in sync', () => {
    render(<Dashboard />)
    const dateInput = screen.getByLabelText('Selected date') as HTMLInputElement
    const log = screen.getByRole('region', { name: 'Food log' })

    fireEvent.click(screen.getByRole('button', { name: 'Next day' }))
    expect(dateInput.value).toBe('2026-06-18')
    expect(screen.getByLabelText('Calories consumed')).toHaveTextContent('0')
    expect(within(log).queryByText('Grilled chicken salad')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Previous day' }))
    expect(dateInput.value).toBe('2026-06-17')
    expect(screen.getByLabelText('Calories consumed')).toHaveTextContent('1435')
    expect(within(log).getByText('Grilled chicken salad')).toBeInTheDocument()
  })

  it('ignores a cleared date input and keeps the steppers working', () => {
    render(<Dashboard />)
    const dateInput = screen.getByLabelText('Selected date') as HTMLInputElement

    // Clearing a native date input fires onChange with an empty value.
    fireEvent.change(dateInput, { target: { value: '' } })
    expect(dateInput.value).toBe('2026-06-17')

    // Steppers still work (no crash from an empty ISO string).
    fireEvent.click(screen.getByRole('button', { name: 'Next day' }))
    expect(dateInput.value).toBe('2026-06-18')
  })
})
