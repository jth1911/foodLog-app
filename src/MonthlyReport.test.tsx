import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MonthlyReport from './MonthlyReport'
import { GOALS_EPOCH, type FoodEntry, type GoalChange } from './lib/nutrition'
import { isoWeekOf, weekdayOf } from './lib/dates'

// Recharts' ResponsiveContainer measures DOM size, which is 0 in jsdom, so the
// real charts render nothing. Mock the library with lightweight stand-ins that
// expose the data they were handed (see WeeklyReport.test.tsx for the rationale).
vi.mock('recharts', () => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>
  return {
    ResponsiveContainer: Passthrough,
    PieChart: Passthrough,
    Pie: ({ data, children }: { data?: unknown[]; children?: React.ReactNode }) => (
      <div data-testid="pie">
        <div data-testid="chart-data">{JSON.stringify(data)}</div>
        {children}
      </div>
    ),
    Cell: () => null,
    Tooltip: () => null,
    Legend: () => null,
  }
})

const TODAY = '2026-06-17' // June 2026 (a 30-day month)

function entry(partial: Partial<FoodEntry> & { date: string }): FoodEntry {
  return {
    id: crypto.randomUUID(),
    week: isoWeekOf(partial.date),
    weekday: weekdayOf(partial.date),
    mealType: 'Lunch',
    description: 'Test food',
    fat: 0,
    carbs: 0,
    protein: 0,
    fiber: 0,
    calories: 0,
    ...partial,
  }
}

function goals(calories: number): GoalChange[] {
  return [
    { effectiveDate: GOALS_EPOCH, goals: { calories, protein: 120, fat: 75, carbs: 130, fiber: 30 } },
  ]
}

describe('MonthlyReport', () => {
  it('shows the selected month and a full calendar of day cells', () => {
    render(<MonthlyReport loggedFoods={[]} goalHistory={goals(2000)} today={TODAY} />)
    expect(screen.getByText('June 2026')).toBeInTheDocument()
    // 30 day cells for June, each labelled 1…30.
    const heatmap = screen.getByLabelText('Calorie heatmap')
    expect(within(heatmap).getByTitle('2026-06-30: no log')).toBeInTheDocument()
  })

  it('ranks the most-logged foods', () => {
    const entries = [
      entry({ date: '2026-06-01', description: 'Eggs' }),
      entry({ date: '2026-06-02', description: 'Eggs' }),
      entry({ date: '2026-06-03', description: 'Oats' }),
    ]
    render(<MonthlyReport loggedFoods={entries} goalHistory={goals(2000)} today={TODAY} />)
    const list = within(screen.getByLabelText('Top foods')).getByRole('list')
    const items = within(list).getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('Eggs')
    expect(items[0]).toHaveTextContent('2×')
    expect(items[1]).toHaveTextContent('Oats')
  })

  it('feeds the macro split to the donut', () => {
    const entries = [entry({ date: '2026-06-10', protein: 100, carbs: 100, fat: 0 })]
    render(<MonthlyReport loggedFoods={entries} goalHistory={goals(2000)} today={TODAY} />)
    // Fat is 0g, so only protein and carbs are passed to the (filtered) pie.
    const data = JSON.parse(screen.getByTestId('chart-data').textContent!)
    expect(data.map((d: { macro: string }) => d.macro)).toEqual(['protein', 'carbs'])
  })

  it('disables forward navigation in the current month and enables it after stepping back', async () => {
    const user = userEvent.setup()
    render(<MonthlyReport loggedFoods={[]} goalHistory={goals(2000)} today={TODAY} />)
    expect(screen.getByRole('button', { name: 'Next month' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Previous month' }))
    expect(screen.getByText('May 2026')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next month' })).toBeEnabled()
  })

  it('colours a logged day by its goal band, neutral when unlogged', () => {
    const entries = [entry({ date: '2026-06-05', calories: 3000 })] // over the 2000 goal
    render(<MonthlyReport loggedFoods={entries} goalHistory={goals(2000)} today={TODAY} />)
    const over = screen.getByTitle('2026-06-05: 3000 kcal — Surplus')
    expect(over.className).toContain('bg-rose-500')
    const empty = screen.getByTitle('2026-06-06: no log')
    expect(empty.className).toContain('bg-slate-100')
  })
})
