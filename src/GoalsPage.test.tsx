import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GoalsPage from './GoalsPage'
import { DEFAULT_GOALS, GOALS_EPOCH, type GoalChange } from './lib/nutrition'

const history: GoalChange[] = [
  { effectiveDate: GOALS_EPOCH, goals: { ...DEFAULT_GOALS, protein: 120 } },
  { effectiveDate: '2026-05-01', goals: { ...DEFAULT_GOALS, protein: 130 } },
]

describe('GoalsPage', () => {
  it('lists entries newest-first', () => {
    render(<GoalsPage goalHistory={history} onAdd={() => {}} onDelete={() => {}} targetWeight={null} onSetTargetWeight={() => {}} />)
    const rows = screen.getByRole('region', { name: 'Goal history' })
    const labels = within(rows)
      .getAllByText(/Initial goal|May 2026/)
      .map((el) => el.textContent)
    expect(labels[0]).toContain('1 May 2026')
    expect(labels[1]).toContain('Initial goal')
  })

  it('labels the sentinel-dated entry as the initial goal', () => {
    render(<GoalsPage goalHistory={history} onAdd={() => {}} onDelete={() => {}} targetWeight={null} onSetTargetWeight={() => {}} />)
    expect(screen.getByText('Initial goal')).toBeInTheDocument()
  })

  it('calls onDelete with the entry effective date', async () => {
    const onDelete = vi.fn()
    const user = userEvent.setup()
    render(<GoalsPage goalHistory={history} onAdd={() => {}} onDelete={onDelete} targetWeight={null} onSetTargetWeight={() => {}} />)

    await user.click(screen.getByRole('button', { name: /Delete goal change 1 May 2026/ }))
    expect(onDelete).toHaveBeenCalledWith('2026-05-01')
  })

  it('disables delete when only one entry remains', () => {
    const single: GoalChange[] = [{ effectiveDate: GOALS_EPOCH, goals: DEFAULT_GOALS }]
    render(<GoalsPage goalHistory={single} onAdd={() => {}} onDelete={() => {}} targetWeight={null} onSetTargetWeight={() => {}} />)
    expect(screen.getByRole('button', { name: /Delete goal change/ })).toBeDisabled()
  })

  it('adds a goal change with the entered date and parsed macros', async () => {
    const onAdd = vi.fn()
    const user = userEvent.setup()
    render(
      <GoalsPage
        goalHistory={history}
        onAdd={onAdd}
        onDelete={() => {}}
        targetWeight={null}
        onSetTargetWeight={() => {}}
        today="2026-06-17"
      />,
    )

    await user.type(screen.getByLabelText('Calories goal'), '2100')
    await user.type(screen.getByLabelText('Protein goal'), '140')
    await user.type(screen.getByLabelText('Fat goal'), '70')
    await user.type(screen.getByLabelText('Carbs goal'), '150')
    await user.type(screen.getByLabelText('Fiber goal'), '35')
    await user.click(screen.getByRole('button', { name: 'Add goal change' }))

    expect(onAdd).toHaveBeenCalledWith('2026-06-17', {
      calories: 2100,
      protein: 140,
      fat: 70,
      carbs: 150,
      fiber: 35,
    })
  })

  it('blocks submit and shows an error when a macro is missing', async () => {
    const onAdd = vi.fn()
    const user = userEvent.setup()
    render(
      <GoalsPage
        goalHistory={history}
        onAdd={onAdd}
        onDelete={() => {}}
        targetWeight={null}
        onSetTargetWeight={() => {}}
        today="2026-06-17"
      />,
    )

    // Fill everything except protein.
    await user.type(screen.getByLabelText('Calories goal'), '2100')
    await user.type(screen.getByLabelText('Fat goal'), '70')
    await user.type(screen.getByLabelText('Carbs goal'), '150')
    await user.type(screen.getByLabelText('Fiber goal'), '35')
    await user.click(screen.getByRole('button', { name: 'Add goal change' }))

    expect(onAdd).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(/Protein must be a non-negative number/)
  })

  describe('target weight', () => {
    it('pre-fills the input with the stored target weight', () => {
      render(
        <GoalsPage
          goalHistory={history}
          onAdd={() => {}}
          onDelete={() => {}}
          targetWeight={165}
          onSetTargetWeight={() => {}}
        />,
      )
      expect(screen.getByLabelText('Target weight (lb)')).toHaveValue(165)
    })

    it('saves an entered target weight', async () => {
      const onSetTargetWeight = vi.fn()
      const user = userEvent.setup()
      render(
        <GoalsPage
          goalHistory={history}
          onAdd={() => {}}
          onDelete={() => {}}
          targetWeight={null}
          onSetTargetWeight={onSetTargetWeight}
        />,
      )

      const region = screen.getByRole('region', { name: 'Target weight' })
      await user.type(screen.getByLabelText('Target weight (lb)'), '170')
      await user.click(within(region).getByRole('button', { name: 'Save' }))
      expect(onSetTargetWeight).toHaveBeenCalledWith(170)
    })

    it('rejects a non-positive target weight', async () => {
      const onSetTargetWeight = vi.fn()
      const user = userEvent.setup()
      render(
        <GoalsPage
          goalHistory={history}
          onAdd={() => {}}
          onDelete={() => {}}
          targetWeight={null}
          onSetTargetWeight={onSetTargetWeight}
        />,
      )

      const region = screen.getByRole('region', { name: 'Target weight' })
      await user.type(screen.getByLabelText('Target weight (lb)'), '-5')
      await user.click(within(region).getByRole('button', { name: 'Save' }))
      expect(onSetTargetWeight).not.toHaveBeenCalled()
      expect(within(region).getByRole('alert')).toHaveTextContent(/greater than zero/i)
    })
  })
})
