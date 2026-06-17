import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

describe('App tab navigation', () => {
  // The dashboard now persists to localStorage; clear it so entries added in one
  // test don't carry into the next.
  beforeEach(() => localStorage.clear())

  it('shows the Dashboard tab by default', () => {
    render(<App />)
    expect(screen.getByRole('tab', { name: 'Dashboard' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Foods' })).toHaveAttribute('aria-selected', 'false')
    // Dashboard content is reachable; the Foods page is hidden from the a11y tree.
    expect(screen.getByRole('heading', { name: 'Food Log' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Dairy/Eggs' })).not.toBeInTheDocument()
  })

  it('switches to the Foods page when the Foods tab is clicked', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('tab', { name: 'Foods' }))

    expect(screen.getByRole('tab', { name: 'Foods' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('heading', { name: 'Dairy/Eggs' })).toBeInTheDocument()
  })

  it('selecting a food returns to the Dashboard with a pre-filled modal', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('tab', { name: 'Foods' }))
    await user.click(screen.getByRole('button', { name: 'Egg' }))

    // Back on the Dashboard, the modal is open and pre-filled from the food.
    const dialog = screen.getByRole('dialog', { name: 'Add food' })
    expect(within(dialog).getByLabelText('Food name')).toHaveValue('Egg')
    expect(within(dialog).getByLabelText('Protein')).toHaveValue(6)
    expect(within(dialog).getByLabelText('Calories')).toHaveValue(70)
    expect(screen.getByRole('tab', { name: 'Dashboard' })).toHaveAttribute('aria-selected', 'true')

    // Submitting adds the entry to the Dashboard feed.
    await user.click(within(dialog).getByRole('button', { name: 'Add' }))
    const log = screen.getByRole('region', { name: 'Food log' })
    expect(within(log).getByText('Egg')).toBeInTheDocument()
  })

  it('opens a blank modal from the FAB after a pre-filled selection was closed', async () => {
    const user = userEvent.setup()
    render(<App />)

    // Pre-fill once, then cancel.
    await user.click(screen.getByRole('tab', { name: 'Foods' }))
    await user.click(screen.getByRole('button', { name: 'Egg' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    // FAB should now open blank, not re-using the previous pre-fill.
    await user.click(screen.getByRole('button', { name: 'Add food' }))
    const dialog = screen.getByRole('dialog', { name: 'Add food' })
    expect(within(dialog).getByLabelText('Food name')).toHaveValue('')
    expect(within(dialog).getByLabelText('Protein')).toHaveValue(null)
  })
})
