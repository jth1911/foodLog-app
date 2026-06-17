import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Dashboard from './Dashboard'

// The five seeded example entries live on this fixed day; pinning `today` to it
// lands the dashboard on the seeded content so these assertions stay deterministic.
const SEED_DATE = '2026-05-01' // a Friday → "Friday, 1 May 2026"
const renderSeeded = () => render(<Dashboard today={SEED_DATE} />)

describe('Dashboard', () => {
  // Start every test from an empty store so the demo seed loads fresh and one
  // test's persisted entries never leak into the next.
  beforeEach(() => localStorage.clear())
  it('renders the heading and summary card', () => {
    renderSeeded()
    expect(screen.getByRole('heading', { name: 'Food Log' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Daily summary' })).toBeInTheDocument()
  })

  it('shows totals computed from the seeded entries', () => {
    renderSeeded()
    // protein: 22 + 0 + 43 + 40 + 2 = 107
    expect(screen.getByLabelText('Protein consumed')).toHaveTextContent('107')
    // calories: 320 + 5 + 430 + 560 + 120 = 1435
    expect(screen.getByLabelText('Calories consumed')).toHaveTextContent('1435')
  })

  it('reflects goal edits immediately in the summary status colour', () => {
    renderSeeded()
    const proteinValue = screen.getByLabelText('Protein consumed').closest('dd')!
    // 107 consumed < 120 goal → unmet
    expect(proteinValue.className).toContain('rose')

    fireEvent.change(screen.getByLabelText('Protein goal'), { target: { value: '100' } })
    // 107 consumed ≥ 100 goal → met
    expect(proteinValue.className).toContain('emerald')
    expect(proteinValue).toHaveTextContent('/ 100')
  })

  it('lets a goal field be cleared without snapping to 0, reverting on blur', () => {
    renderSeeded()
    const proteinGoal = screen.getByLabelText('Protein goal') as HTMLInputElement

    // Clearing keeps the field blank for free retyping rather than forcing 0.
    fireEvent.change(proteinGoal, { target: { value: '' } })
    expect(proteinGoal.value).toBe('')
    // The summary still reflects the previous committed goal (120), not 0.
    const proteinValue = screen.getByLabelText('Protein consumed').closest('dd')!
    expect(proteinValue).toHaveTextContent('/ 120')

    // Blurring while blank discards the in-progress edit and re-syncs to 120.
    fireEvent.blur(proteinGoal)
    expect(proteinGoal.value).toBe('120')
  })

  it('groups food entries under the correct meal headings', () => {
    renderSeeded()
    const log = screen.getByRole('region', { name: 'Food log' })
    expect(within(log).getByRole('heading', { name: 'Breakfast' })).toBeInTheDocument()
    expect(within(log).getByRole('heading', { name: 'Lunch' })).toBeInTheDocument()
    expect(within(log).getByRole('heading', { name: 'Dinner' })).toBeInTheDocument()
    expect(within(log).getByText('Grilled chicken salad')).toBeInTheDocument()
    expect(within(log).getByText('Salmon, quinoa & broccoli')).toBeInTheDocument()
  })

  it('renders a date control initialised to the landing date', () => {
    renderSeeded()
    expect(screen.getByRole('button', { name: 'Choose date' })).toHaveTextContent(
      'Friday, 1 May 2026',
    )
    expect(screen.getByRole('button', { name: 'Previous day' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next day' })).toBeInTheDocument()
  })

  it('shows zero totals and empty meal states for a day with no entries', () => {
    renderSeeded()
    // Step to the next (empty) day.
    fireEvent.click(screen.getByRole('button', { name: 'Next day' }))
    expect(screen.getByRole('button', { name: 'Choose date' })).toHaveTextContent(
      'Saturday, 2 May 2026',
    )
    expect(screen.getByLabelText('Calories consumed')).toHaveTextContent('0')
    expect(screen.getByLabelText('Protein consumed')).toHaveTextContent('0')

    const log = screen.getByRole('region', { name: 'Food log' })
    expect(within(log).queryByText('Grilled chicken salad')).not.toBeInTheDocument()
    expect(within(log).getByText(/no food logged for breakfast yet/i)).toBeInTheDocument()
  })

  it('steps the date forward and back one day, keeping summary and feed in sync', () => {
    renderSeeded()
    const dateButton = screen.getByRole('button', { name: 'Choose date' })
    const log = screen.getByRole('region', { name: 'Food log' })

    fireEvent.click(screen.getByRole('button', { name: 'Next day' }))
    expect(dateButton).toHaveTextContent('Saturday, 2 May 2026')
    expect(screen.getByLabelText('Calories consumed')).toHaveTextContent('0')
    expect(within(log).queryByText('Grilled chicken salad')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Previous day' }))
    expect(dateButton).toHaveTextContent('Friday, 1 May 2026')
    expect(screen.getByLabelText('Calories consumed')).toHaveTextContent('1435')
    expect(within(log).getByText('Grilled chicken salad')).toBeInTheDocument()
  })

  describe('calendar picker', () => {
    it('lands on the real current date when no date is injected', () => {
      vi.useFakeTimers()
      // Midday local time, away from any UTC day boundary; not the seed day.
      vi.setSystemTime(new Date(2026, 2, 10, 12, 0, 0))
      try {
        render(<Dashboard />)
        expect(screen.getByRole('button', { name: 'Choose date' })).toHaveTextContent(
          'Tuesday, 10 March 2026',
        )
        // Seeded content lives on 2026-05-01, so today is empty.
        expect(screen.getByLabelText('Calories consumed')).toHaveTextContent('0')
        expect(screen.queryByText('Greek yogurt with berries & granola')).not.toBeInTheDocument()
      } finally {
        vi.useRealTimers()
      }
    })

    it('selects a day from the month grid and round-trips back to the seeded day', async () => {
      const user = userEvent.setup()
      renderSeeded()

      // Open the popover and pick a "fuzzy" mid-month day by glancing at the grid.
      await user.click(screen.getByRole('button', { name: 'Choose date' }))
      const calendar = screen.getByRole('dialog', { name: 'Calendar' })
      await user.click(within(calendar).getByRole('button', { name: /, 15 May 2026/ }))

      // Popover closes; the empty day is now selected.
      expect(screen.queryByRole('dialog', { name: 'Calendar' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Choose date' })).toHaveTextContent(
        'Friday, 15 May 2026',
      )
      expect(screen.getByLabelText('Calories consumed')).toHaveTextContent('0')

      // Picking the seeded day again brings its content back (ISO↔Date round-trip).
      await user.click(screen.getByRole('button', { name: 'Choose date' }))
      const reopened = screen.getByRole('dialog', { name: 'Calendar' })
      await user.click(within(reopened).getByRole('button', { name: /, 1 May 2026/ }))
      expect(screen.getByRole('button', { name: 'Choose date' })).toHaveTextContent(
        'Friday, 1 May 2026',
      )
      expect(screen.getByLabelText('Calories consumed')).toHaveTextContent('1435')
    })

    it('jumps back to today after navigating away', () => {
      renderSeeded()
      fireEvent.click(screen.getByRole('button', { name: 'Next day' }))
      expect(screen.getByRole('button', { name: 'Choose date' })).toHaveTextContent(
        'Saturday, 2 May 2026',
      )
      fireEvent.click(screen.getByRole('button', { name: 'Today' }))
      expect(screen.getByRole('button', { name: 'Choose date' })).toHaveTextContent(
        'Friday, 1 May 2026',
      )
    })
  })

  describe('adding and deleting entries', () => {
    afterEach(() => vi.restoreAllMocks())

    it('adds an entry via the modal and updates the feed and totals', async () => {
      const user = userEvent.setup()
      renderSeeded()

      await user.click(screen.getByRole('button', { name: 'Add food' }))
      await user.type(screen.getByLabelText('Food name'), 'Protein shake')
      await user.selectOptions(screen.getByLabelText('Meal type'), 'Snacks')
      await user.type(screen.getByLabelText('Calories'), '200')
      await user.type(screen.getByLabelText('Protein'), '30')
      await user.click(screen.getByRole('button', { name: 'Add' }))

      const log = screen.getByRole('region', { name: 'Food log' })
      expect(within(log).getByText('Protein shake')).toBeInTheDocument()
      // calories 1435 + 200 = 1635, protein 107 + 30 = 137
      expect(screen.getByLabelText('Calories consumed')).toHaveTextContent('1635')
      expect(screen.getByLabelText('Protein consumed')).toHaveTextContent('137')
    })

    it('stamps the new entry with the selected date, not today', async () => {
      const user = userEvent.setup()
      renderSeeded()

      // Move to an empty day and add there.
      fireEvent.click(screen.getByRole('button', { name: 'Next day' }))
      expect(screen.getByRole('button', { name: 'Choose date' })).toHaveTextContent(
        'Saturday, 2 May 2026',
      )

      await user.click(screen.getByRole('button', { name: 'Add food' }))
      await user.type(screen.getByLabelText('Food name'), 'Banana')
      await user.type(screen.getByLabelText('Calories'), '105')
      await user.click(screen.getByRole('button', { name: 'Add' }))

      expect(screen.getByText('Banana')).toBeInTheDocument()
      expect(screen.getByLabelText('Calories consumed')).toHaveTextContent('105')

      // Going back to the seed day must not show the new entry.
      fireEvent.click(screen.getByRole('button', { name: 'Previous day' }))
      expect(screen.queryByText('Banana')).not.toBeInTheDocument()
      expect(screen.getByLabelText('Calories consumed')).toHaveTextContent('1435')
    })

    it('deletes an entry after confirmation and updates totals', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      renderSeeded()

      fireEvent.click(screen.getByRole('button', { name: 'Delete Black coffee' }))
      expect(screen.queryByText('Black coffee')).not.toBeInTheDocument()
      // Black coffee was 5 kcal: 1435 - 5 = 1430.
      expect(screen.getByLabelText('Calories consumed')).toHaveTextContent('1430')
    })
  })
})
