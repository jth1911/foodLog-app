import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
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
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    Legend: () => null,
    ReferenceLine: () => null,
  }
})

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

// The chart-data the mocked Pie inside a named region was handed.
function pieDataIn(regionName: string): unknown[] {
  const region = screen.getByRole('region', { name: regionName })
  return JSON.parse(region.querySelector('[data-testid="chart-data"]')!.textContent!)
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
    const lineChart = screen.getByTestId('line-chart')
    const data = JSON.parse(lineChart.querySelector('[data-testid="chart-data"]')!.textContent!)
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

  it('feeds the protein pie its visible food-group slices from the library', () => {
    const entries = [
      entry({ date: TODAY, description: 'Chicken breast', protein: 30 }),
      entry({ date: '2026-06-16', description: 'Greek yogurt', protein: 10 }),
      entry({ date: '2026-06-15', description: 'Mystery bar', protein: 10 }), // → Other
    ]
    render(
      <WeeklyReport loggedFoods={entries} goalHistory={goals} foods={library} today={TODAY} />,
    )
    const data = pieDataIn('Protein sources') as Array<{ category: string; protein: number }>
    const byCategory = Object.fromEntries(data.map((d) => [d.category, d.protein]))
    expect(byCategory['Meat/Poultry']).toBe(30)
    expect(byCategory['Dairy/Eggs']).toBe(10)
    expect(byCategory['Other']).toBe(10)
    // Empty groups are filtered out of the pie's data.
    expect(byCategory['Seafood']).toBeUndefined()
  })
})
