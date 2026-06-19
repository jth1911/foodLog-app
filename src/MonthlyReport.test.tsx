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
    LineChart: ({ data, children }: { data?: unknown[]; children?: React.ReactNode }) => (
      <div data-testid="line-chart">
        <div data-testid="chart-data">{JSON.stringify(data)}</div>
        {children}
      </div>
    ),
    BarChart: ({ data, children }: { data?: unknown[]; children?: React.ReactNode }) => (
      <div data-testid="bar-chart">
        <div data-testid="chart-data">{JSON.stringify(data)}</div>
        {children}
      </div>
    ),
    Line: () => null,
    Bar: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    Cell: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    Legend: () => null,
    ReferenceLine: ({ y }: { y?: number }) => <div data-testid="reference-line" data-y={y} />,
  }
})

// The chart-data a named region's chart was handed.
function chartDataIn(regionName: string): unknown[] {
  const region = screen.getByRole('region', { name: regionName })
  return JSON.parse(region.querySelector('[data-testid="chart-data"]')!.textContent!)
}

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

  it('lists at most the top 10 foods', () => {
    // 12 distinct foods, each logged once, all in June.
    const entries = Array.from({ length: 12 }, (_, i) =>
      entry({ date: '2026-06-01', description: `Food ${i}` }),
    )
    render(<MonthlyReport loggedFoods={entries} goalHistory={goals(2000)} today={TODAY} />)
    const list = within(screen.getByLabelText('Top foods')).getByRole('list')
    expect(within(list).getAllByRole('listitem')).toHaveLength(10)
  })

  it('feeds the macro split to the donut', () => {
    const entries = [entry({ date: '2026-06-10', protein: 100, carbs: 100, fat: 0 })]
    render(<MonthlyReport loggedFoods={entries} goalHistory={goals(2000)} today={TODAY} />)
    // Fat is 0g, so only protein and carbs are passed to the (filtered) pie.
    const data = chartDataIn('Macro ratio') as { macro: string }[]
    expect(data.map((d) => d.macro)).toEqual(['protein', 'carbs'])
  })

  it('disables forward navigation in the current month and enables it after stepping back', async () => {
    const user = userEvent.setup()
    render(<MonthlyReport loggedFoods={[]} goalHistory={goals(2000)} today={TODAY} />)
    expect(screen.getByRole('button', { name: 'Next month' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Previous month' }))
    expect(screen.getByText('May 2026')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next month' })).toBeEnabled()
  })

  it('colours a logged calorie day by its goal band, neutral when unlogged', () => {
    // goal 2000, ±10% band → floor 1800, ceiling 2200. Under is the win → green.
    const entries = [
      entry({ date: '2026-06-03', calories: 1500 }), // comfortably under → green
      entry({ date: '2026-06-04', calories: 2000 }), // nearing the goal → amber
      entry({ date: '2026-06-05', calories: 3000 }), // over → red
    ]
    render(<MonthlyReport loggedFoods={entries} goalHistory={goals(2000)} today={TODAY} />)
    const heatmap = within(screen.getByLabelText('Calorie heatmap'))
    expect(heatmap.getByTitle('2026-06-03: 1500 kcal — Under').className).toContain('bg-emerald-500')
    expect(heatmap.getByTitle('2026-06-04: 2000 kcal — Near goal').className).toContain('bg-amber-400')
    expect(heatmap.getByTitle('2026-06-05: 3000 kcal — Surplus').className).toContain('bg-rose-500')
    expect(heatmap.getByTitle('2026-06-06: no log').className).toContain('bg-slate-100')
  })

  it('colours the protein heatmap inverted — hitting the goal is green', () => {
    // protein goal 120, ±10% band → floor 108, ceiling 132. More is better, so
    // green/red invert vs calories: over is green, under is red.
    const entries = [
      entry({ date: '2026-06-03', protein: 90 }), // missed → red
      entry({ date: '2026-06-04', protein: 120 }), // near goal → amber
      entry({ date: '2026-06-05', protein: 150 }), // hit → green
    ]
    render(<MonthlyReport loggedFoods={entries} goalHistory={goals(2000)} today={TODAY} />)
    const heatmap = within(screen.getByLabelText('Protein heatmap'))
    expect(heatmap.getByTitle('2026-06-03: 90 g — Missed').className).toContain('bg-rose-500')
    expect(heatmap.getByTitle('2026-06-04: 120 g — Near goal').className).toContain('bg-amber-400')
    expect(heatmap.getByTitle('2026-06-05: 150 g — Hit').className).toContain('bg-emerald-500')
  })

  it('shows each logged calorie day total in its cell, with a thousands separator', () => {
    const entries = [entry({ date: '2026-06-03', calories: 2140 })]
    render(<MonthlyReport loggedFoods={entries} goalHistory={goals(2000)} today={TODAY} />)
    const heatmap = within(screen.getByLabelText('Calorie heatmap'))
    expect(heatmap.getByTitle('2026-06-03: 2140 kcal — Near goal')).toHaveTextContent('2,140')
  })

  it('shows each logged protein day total in its cell, suffixed with g', () => {
    const entries = [entry({ date: '2026-06-03', protein: 138 })]
    render(<MonthlyReport loggedFoods={entries} goalHistory={goals(2000)} today={TODAY} />)
    const heatmap = within(screen.getByLabelText('Protein heatmap'))
    expect(heatmap.getByTitle('2026-06-03: 138 g — Hit')).toHaveTextContent('138g')
  })

  it('rounds the in-cell value to a whole number', () => {
    const entries = [entry({ date: '2026-06-03', protein: 137.6 })]
    render(<MonthlyReport loggedFoods={entries} goalHistory={goals(2000)} today={TODAY} />)
    const heatmap = within(screen.getByLabelText('Protein heatmap'))
    expect(heatmap.getByTitle('2026-06-03: 138 g — Hit')).toHaveTextContent('138g')
  })

  it('shows no value on unlogged days — only the day number', () => {
    render(<MonthlyReport loggedFoods={[]} goalHistory={goals(2000)} today={TODAY} />)
    const heatmap = within(screen.getByLabelText('Calorie heatmap'))
    // An empty day carries just its day-of-month, never a macro value.
    expect(heatmap.getByTitle('2026-06-06: no log').textContent).toBe('6')
  })

  describe('weight trend', () => {
    const weights = [
      { date: '2026-06-01', lb: 180 },
      { date: '2026-06-15', lb: 178 },
    ]

    it('shows an empty state when no weight is logged this month', () => {
      render(<MonthlyReport loggedFoods={[]} goalHistory={goals(2000)} today={TODAY} weights={[]} />)
      expect(screen.getByText('No weight logged this month.')).toBeInTheDocument()
    })

    it('feeds the line chart only the recorded days for the month (gaps null)', () => {
      render(
        <MonthlyReport
          loggedFoods={[]}
          goalHistory={goals(2000)}
          today={TODAY}
          weights={weights}
        />,
      )
      const data = chartDataIn('Weight trend') as { date: string; lb: number | null }[]
      expect(data).toHaveLength(30) // June
      expect(data.find((d) => d.date === '2026-06-01')!.lb).toBe(180)
      expect(data.find((d) => d.date === '2026-06-15')!.lb).toBe(178)
      expect(data.find((d) => d.date === '2026-06-10')!.lb).toBeNull() // unlogged → gap
    })

    it('renders the target reference line when a target is set', () => {
      render(
        <MonthlyReport
          loggedFoods={[]}
          goalHistory={goals(2000)}
          today={TODAY}
          weights={weights}
          targetWeight={170}
        />,
      )
      const region = screen.getByRole('region', { name: 'Weight trend' })
      const ref = region.querySelector('[data-testid="reference-line"]')
      expect(ref).not.toBeNull()
      expect(ref!.getAttribute('data-y')).toBe('170')
    })
  })

  describe('fluid intake', () => {
    const fluid = (date: string, oz: number) => ({
      id: crypto.randomUUID(),
      date,
      week: isoWeekOf(date),
      weekday: weekdayOf(date),
      drinkType: 'Water' as const,
      oz,
      calories: 0,
    })

    it('shows an empty state when no fluid is logged this month', () => {
      render(<MonthlyReport loggedFoods={[]} goalHistory={goals(2000)} today={TODAY} fluids={[]} />)
      expect(screen.getByText('No fluid logged this month.')).toBeInTheDocument()
    })

    it('feeds the fluid chart one oz total per day for the month', () => {
      const fluids = [fluid('2026-06-01', 16), fluid('2026-06-01', 8), fluid('2026-06-15', 40)]
      render(
        <MonthlyReport loggedFoods={[]} goalHistory={goals(2000)} today={TODAY} fluids={fluids} />,
      )
      const data = chartDataIn('Fluid intake') as { date: string; oz: number }[]
      expect(data).toHaveLength(30)
      expect(data.find((d) => d.date === '2026-06-01')!.oz).toBe(24)
      expect(data.find((d) => d.date === '2026-06-15')!.oz).toBe(40)
      expect(data.find((d) => d.date === '2026-06-10')!.oz).toBe(0)
    })

    it('renders the target reference line on the fluid chart when set', () => {
      render(
        <MonthlyReport
          loggedFoods={[]}
          goalHistory={goals(2000)}
          today={TODAY}
          fluids={[fluid('2026-06-01', 24)]}
          targetFluid={64}
        />,
      )
      const region = screen.getByRole('region', { name: 'Fluid intake' })
      const ref = region.querySelector('[data-testid="reference-line"]')
      expect(ref!.getAttribute('data-y')).toBe('64')
    })

    it('splits the by-type chart into one oz field per drink type per day', () => {
      const drink = (date: string, drinkType: 'Water' | 'Coffee' | 'Tea', oz: number) => ({
        id: crypto.randomUUID(),
        date,
        week: isoWeekOf(date),
        weekday: weekdayOf(date),
        drinkType,
        oz,
        calories: 0,
      })
      const fluids = [
        drink('2026-06-01', 'Water', 16),
        drink('2026-06-01', 'Coffee', 12),
        drink('2026-06-15', 'Tea', 8),
      ]
      render(
        <MonthlyReport loggedFoods={[]} goalHistory={goals(2000)} today={TODAY} fluids={fluids} />,
      )
      const data = chartDataIn('Fluid by type') as Array<Record<string, number | string>>
      const first = data.find((d) => d.date === '2026-06-01')!
      expect(first.Water).toBe(16)
      expect(first.Coffee).toBe(12)
      expect(data.find((d) => d.date === '2026-06-15')!.Tea).toBe(8)
    })

    it('shows an empty state for the by-type chart when no fluid is logged', () => {
      render(<MonthlyReport loggedFoods={[]} goalHistory={goals(2000)} today={TODAY} fluids={[]} />)
      const region = screen.getByRole('region', { name: 'Fluid by type' })
      expect(within(region).getByText(/no fluid logged this month/i)).toBeInTheDocument()
    })
  })
})
