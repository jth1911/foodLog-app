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
})
