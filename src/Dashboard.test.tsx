import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Dashboard, { DashboardView } from './Dashboard'
import { DEFAULT_GOALS, GOALS_EPOCH, type FoodEntry, type GoalChange } from './lib/nutrition'

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

  it('shows the seeded default goal in the summary, read-only (no goal inputs)', () => {
    renderSeeded()
    // The default-goal history resolves to protein 120; summary compares to it.
    expect(screen.getByLabelText('Protein consumed').closest('dd')!).toHaveTextContent('/ 120')
    // Editing moved to the Goals tab — there are no goal inputs on the dashboard.
    expect(screen.queryByLabelText('Protein goal')).not.toBeInTheDocument()
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

  describe('editing entries', () => {
    it('edits an entry in place via the modal and updates totals', async () => {
      const user = userEvent.setup()
      renderSeeded()

      await user.click(screen.getByRole('button', { name: 'Edit Black coffee' }))
      const dialog = screen.getByRole('dialog', { name: 'Edit food' })
      expect(within(dialog).getByLabelText('Food name')).toHaveValue('Black coffee')

      fireEvent.change(within(dialog).getByLabelText('Calories'), { target: { value: '15' } })
      await user.click(within(dialog).getByRole('button', { name: 'Save' }))

      // The modal closes and totals reflect the edit: 1435 - 5 + 15 = 1445.
      expect(screen.queryByRole('dialog', { name: 'Edit food' })).not.toBeInTheDocument()
      expect(screen.getByLabelText('Calories consumed')).toHaveTextContent('1445')
    })

    it('drops the serving/quantity label when a scaled entry is edited', async () => {
      const user = userEvent.setup()
      const updateEntry = vi.fn()
      const scaled: FoodEntry = {
        id: 's1',
        date: '2026-05-01',
        week: 18,
        weekday: 'Friday',
        mealType: 'Breakfast',
        description: 'Egg',
        fat: 0,
        carbs: 1,
        protein: 6,
        fiber: 0,
        calories: 70,
        servingSize: '1 large',
        quantity: 1,
      }
      render(
        <DashboardView
          today="2026-05-01"
          loggedFoods={[scaled]}
          goalHistory={[{ effectiveDate: GOALS_EPOCH, goals: DEFAULT_GOALS }]}
          addEntry={() => {}}
          addEntries={() => {}}
          deleteEntry={() => {}}
          updateEntry={updateEntry}
        />,
      )

      await user.click(screen.getByRole('button', { name: 'Edit Egg' }))
      await user.click(screen.getByRole('button', { name: 'Save' }))

      expect(updateEntry).toHaveBeenCalledTimes(1)
      const updated = updateEntry.mock.calls[0][0] as FoodEntry
      expect(updated.id).toBe('s1')
      expect(updated.servingSize).toBeUndefined()
      expect(updated.quantity).toBeUndefined()
    })
  })

  describe('CSV import', () => {
    const HEADER = 'Date,Meal Type,Food Description,Fat,Carbs,Protein,Calories,Fiber'
    const csvFile = (...rows: string[]) =>
      new File([[HEADER, ...rows].join('\n')], 'meals.csv', { type: 'text/csv' })

    it('opens the import modal from the Import CSV button', async () => {
      const user = userEvent.setup()
      render(
        <DashboardView
          today="2026-05-01"
          loggedFoods={[]}
          goalHistory={[{ effectiveDate: GOALS_EPOCH, goals: DEFAULT_GOALS }]}
          addEntry={() => {}}
          addEntries={() => {}}
          deleteEntry={() => {}}
          updateEntry={() => {}}
        />,
      )

      await user.click(screen.getByRole('button', { name: /import csv/i }))
      expect(screen.getByRole('dialog', { name: /import food entries/i })).toBeInTheDocument()
    })

    it('imports valid rows and navigates to the first entry’s date', async () => {
      const user = userEvent.setup()
      const addEntries = vi.fn()
      render(
        <DashboardView
          today="2026-05-01"
          loggedFoods={[]}
          goalHistory={[{ effectiveDate: GOALS_EPOCH, goals: DEFAULT_GOALS }]}
          addEntry={() => {}}
          addEntries={addEntries}
          deleteEntry={() => {}}
          updateEntry={() => {}}
        />,
      )

      await user.click(screen.getByRole('button', { name: /import csv/i }))
      await user.upload(
        screen.getByLabelText(/choose csv file/i),
        csvFile('5/27/2026,Breakfast,Egg,5,1,6,70,0'),
      )
      await screen.findByText(/1 valid/i)
      await user.click(screen.getByRole('button', { name: /import 1/i }))

      expect(addEntries).toHaveBeenCalledTimes(1)
      expect(addEntries.mock.calls[0][0]).toHaveLength(1)
      // The header date label jumps to the imported entry's day.
      expect(screen.getByRole('heading', { name: 'Food Log' }).nextSibling).toHaveTextContent(
        /27 May 2026/,
      )
    })
  })

  // DashboardView is the presentational form App renders with a shared store.
  // Driving it directly lets us pin a dated goal history.
  describe('read-only goal resolution', () => {
    const history: GoalChange[] = [
      { effectiveDate: GOALS_EPOCH, goals: { ...DEFAULT_GOALS, protein: 120 } },
      { effectiveDate: '2026-05-01', goals: { ...DEFAULT_GOALS, protein: 130 } },
    ]
    const renderView = (today: string) =>
      render(
        <DashboardView
          today={today}
          loggedFoods={[]}
          goalHistory={history}
          addEntry={() => {}}
          addEntries={() => {}}
          deleteEntry={() => {}}
          updateEntry={() => {}}
        />,
      )

    it('shows the goal in effect for the selected date', () => {
      renderView('2026-05-01')
      const protein = screen.getByLabelText('Protein consumed').closest('dd')!
      expect(protein).toHaveTextContent('/ 130')
    })

    it('switches to the earlier goal when navigating before the change', () => {
      renderView('2026-05-01')
      const protein = screen.getByLabelText('Protein consumed').closest('dd')!
      expect(protein).toHaveTextContent('/ 130')

      // Step back across the 2026-05-01 boundary → the earlier 120 goal applies.
      fireEvent.click(screen.getByRole('button', { name: 'Previous day' }))
      expect(protein).toHaveTextContent('/ 120')
    })
  })
})
