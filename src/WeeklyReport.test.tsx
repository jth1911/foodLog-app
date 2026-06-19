import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import WeeklyReport from './WeeklyReport'
import { GOALS_EPOCH, type FoodEntry, type GoalChange } from './lib/nutrition'
import { type UserFoodReference } from './lib/foods'
import { isoWeekOf, weekdayOf } from './lib/dates'

// Recharts' ResponsiveContainer measures DOM size, which is 0 in jsdom, so the
// real charts render nothing. Mock the library with lightweight stand-ins that
// expose the data they were handed, so we can assert the page wires the right
// series in without depending on SVG layout. The streak widget is plain DOM and
// is tested directly through the page.
vi.mock('recharts', () => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>
  const dataAttr = (data?: unknown[]) => <div data-testid="chart-data">{JSON.stringify(data)}</div>
  return {
    ResponsiveContainer: Passthrough,
    LineChart: ({ data, children }: { data?: unknown[]; children?: React.ReactNode }) => (
      <div data-testid="line-chart">{dataAttr(data)}{children}</div>
    ),
    BarChart: ({ data, children }: { data?: unknown[]; children?: React.ReactNode }) => (
      <div data-testid="bar-chart">{dataAttr(data)}{children}</div>
    ),
    PieChart: Passthrough,
    Pie: ({ data, children }: { data?: unknown[]; children?: React.ReactNode }) => (
      <div data-testid="pie">{dataAttr(data)}{children}</div>
    ),
    Line: () => null,
    Bar: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    Cell: () => null,
    LabelList: () => null,
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

const TODAY = '2026-06-17' // a Wednesday

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

const goals: GoalChange[] = [
  {
    effectiveDate: GOALS_EPOCH,
    goals: { calories: 2000, protein: 150, fat: 75, carbs: 130, fiber: 30 },
  },
]

const refFood = (food: string): UserFoodReference => ({
  id: food,
  food,
  serving_size: '1',
  protein: 0,
  carbs: 0,
  calories: 0,
})

// A minimal library so logged descriptions resolve to a food group.
const library: Record<string, UserFoodReference[]> = {
  'Meat/Poultry': [refFood('Chicken breast')],
  'Dairy/Eggs': [refFood('Greek yogurt')],
}

describe('WeeklyReport', () => {
  it('renders all four insight sections', () => {
    render(<WeeklyReport loggedFoods={[]} goalHistory={goals} today={TODAY} />)
    expect(screen.getByRole('region', { name: 'Macro consistency' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Protein streak' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Fiber vs goal' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Meal breakdown' })).toBeInTheDocument()
  })

  it('shows the protein streak count against the configured goal', () => {
    const entries = [
      entry({ date: '2026-06-15', protein: 160 }), // hit
      entry({ date: '2026-06-16', protein: 200 }), // hit
      entry({ date: '2026-06-17', protein: 100 }), // miss
    ]
    render(<WeeklyReport loggedFoods={entries} goalHistory={goals} today={TODAY} />)
    const streak = screen.getByRole('region', { name: 'Protein streak' })
    expect(streak).toHaveTextContent('150 g protein goal')
    expect(streak).toHaveTextContent('2 / 7')
  })

  it('reflects the fiber goal in the heading', () => {
    render(<WeeklyReport loggedFoods={[]} goalHistory={goals} today={TODAY} />)
    expect(screen.getByRole('region', { name: 'Fiber vs goal' })).toHaveTextContent('30 g target')
  })

  it('shows an empty state for the meal pie when nothing is logged', () => {
    render(<WeeklyReport loggedFoods={[]} goalHistory={goals} today={TODAY} />)
    expect(screen.getByText('No calories logged this week.')).toBeInTheDocument()
  })

  it('feeds the line chart the 7-day macro series ending today', () => {
    const entries = [entry({ date: TODAY, protein: 42, carbs: 10, fat: 5 })]
    render(<WeeklyReport loggedFoods={entries} goalHistory={goals} today={TODAY} />)
    const data = chartDataIn('Macro consistency') as { date: string; protein: number }[]
    expect(data).toHaveLength(7)
    expect(data[6]).toMatchObject({ date: TODAY, protein: 42 })
  })

  it('navigates to the previous week when the prev button is clicked', async () => {
    const user = userEvent.setup()
    // A protein hit one week before today; absent from this week, present last.
    const entries = [entry({ date: '2026-06-10', protein: 200 })]
    render(<WeeklyReport loggedFoods={entries} goalHistory={goals} today={TODAY} />)

    const streak = screen.getByRole('region', { name: 'Protein streak' })
    expect(streak).toHaveTextContent('0 / 7') // this week: no hits

    await user.click(screen.getByRole('button', { name: 'Previous week' }))
    expect(streak).toHaveTextContent('1 / 7') // last week: the 2026-06-10 hit
  })

  it('renders the protein-source breakdown section', () => {
    render(<WeeklyReport loggedFoods={[]} goalHistory={goals} today={TODAY} />)
    expect(screen.getByRole('region', { name: 'Protein sources' })).toBeInTheDocument()
  })

  it('shows an empty state for the protein pie when no protein is logged', () => {
    render(<WeeklyReport loggedFoods={[]} goalHistory={goals} today={TODAY} />)
    expect(screen.getByText('No protein logged this week.')).toBeInTheDocument()
  })

  it('shows an empty state for the weight chart when none is logged', () => {
    render(<WeeklyReport loggedFoods={[]} goalHistory={goals} today={TODAY} weights={[]} />)
    expect(screen.getByText('No weight logged this week.')).toBeInTheDocument()
  })

  it('feeds the weight chart only the recorded days (gaps stay null)', () => {
    const weights = [
      { date: '2026-06-11', lb: 180 },
      { date: '2026-06-14', lb: 179 },
    ]
    render(<WeeklyReport loggedFoods={[]} goalHistory={goals} today={TODAY} weights={weights} />)
    const data = chartDataIn('Weight trend') as { date: string; lb: number | null }[]
    expect(data).toHaveLength(7)
    expect(data.find((d) => d.date === '2026-06-11')!.lb).toBe(180)
    expect(data.find((d) => d.date === '2026-06-14')!.lb).toBe(179)
    expect(data.find((d) => d.date === '2026-06-12')!.lb).toBeNull() // unlogged → gap
    expect(data.find((d) => d.date === '2026-06-17')!.lb).toBeNull() // unlogged → gap
  })

  it('renders the target reference line on the weight chart when set', () => {
    const weights = [{ date: '2026-06-11', lb: 180 }]
    render(
      <WeeklyReport
        loggedFoods={[]}
        goalHistory={goals}
        today={TODAY}
        weights={weights}
        targetWeight={170}
      />,
    )
    const region = screen.getByRole('region', { name: 'Weight trend' })
    const ref = region.querySelector('[data-testid="reference-line"]')
    expect(ref!.getAttribute('data-y')).toBe('170')
  })

  it('feeds the protein bar chart its visible food-group slices from the library', () => {
    const entries = [
      entry({ date: TODAY, description: 'Chicken breast', protein: 30 }),
      entry({ date: '2026-06-16', description: 'Greek yogurt', protein: 10 }),
      entry({ date: '2026-06-15', description: 'Mystery bar', protein: 10 }), // → Other
    ]
    render(
      <WeeklyReport loggedFoods={entries} goalHistory={goals} foods={library} today={TODAY} />,
    )
    const data = chartDataIn('Protein sources') as Array<{ category: string; protein: number }>
    const byCategory = Object.fromEntries(data.map((d) => [d.category, d.protein]))
    expect(byCategory['Meat/Poultry']).toBe(30)
    expect(byCategory['Dairy/Eggs']).toBe(10)
    expect(byCategory['Other']).toBe(10)
    // Empty groups are filtered out of the chart's data.
    expect(byCategory['Seafood']).toBeUndefined()
  })

  it('sorts the protein bars descending by protein so the dominant source leads', () => {
    const entries = [
      entry({ date: TODAY, description: 'Greek yogurt', protein: 10 }),
      entry({ date: '2026-06-16', description: 'Chicken breast', protein: 30 }),
      entry({ date: '2026-06-15', description: 'Mystery bar', protein: 20 }), // → Other
    ]
    render(
      <WeeklyReport loggedFoods={entries} goalHistory={goals} foods={library} today={TODAY} />,
    )
    const data = chartDataIn('Protein sources') as Array<{ category: string; protein: number }>
    expect(data.map((d) => d.category)).toEqual(['Meat/Poultry', 'Other', 'Dairy/Eggs'])
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

    it('shows an empty state when no fluid is logged this week', () => {
      render(<WeeklyReport loggedFoods={[]} goalHistory={goals} today={TODAY} fluids={[]} />)
      expect(screen.getByText('No fluid logged this week.')).toBeInTheDocument()
    })

    it('feeds the fluid chart one oz total per day across the window', () => {
      const fluids = [fluid('2026-06-16', 16), fluid('2026-06-16', 8), fluid(TODAY, 24)]
      render(<WeeklyReport loggedFoods={[]} goalHistory={goals} today={TODAY} fluids={fluids} />)
      const data = chartDataIn('Fluid intake') as { date: string; oz: number }[]
      expect(data).toHaveLength(7)
      expect(data.find((d) => d.date === '2026-06-16')!.oz).toBe(24)
      expect(data.find((d) => d.date === TODAY)!.oz).toBe(24)
      expect(data.find((d) => d.date === '2026-06-15')!.oz).toBe(0)
    })

    it('renders the target reference line on the fluid chart when set', () => {
      const fluids = [fluid(TODAY, 24)]
      render(
        <WeeklyReport
          loggedFoods={[]}
          goalHistory={goals}
          today={TODAY}
          fluids={fluids}
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
      const fluids = [drink(TODAY, 'Water', 16), drink(TODAY, 'Coffee', 12), drink('2026-06-16', 'Tea', 8)]
      render(<WeeklyReport loggedFoods={[]} goalHistory={goals} today={TODAY} fluids={fluids} />)
      const data = chartDataIn('Fluid by type') as Array<Record<string, number | string>>
      const today = data.find((d) => d.date === TODAY)!
      expect(today.Water).toBe(16)
      expect(today.Coffee).toBe(12)
      expect(today.Tea).toBe(0)
      expect(data.find((d) => d.date === '2026-06-16')!.Tea).toBe(8)
    })

    it('shows an empty state for the by-type chart when no fluid is logged', () => {
      render(<WeeklyReport loggedFoods={[]} goalHistory={goals} today={TODAY} fluids={[]} />)
      const region = screen.getByRole('region', { name: 'Fluid by type' })
      expect(within(region).getByText(/no fluid logged this week/i)).toBeInTheDocument()
    })
  })
})
