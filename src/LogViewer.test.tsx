import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LogViewer from './LogViewer'
import { log, clearLog } from './lib/logger'

describe('LogViewer', () => {
  beforeEach(() => clearLog())

  it('shows only the launcher icon until opened', () => {
    render(<LogViewer />)
    expect(screen.getByRole('button', { name: /event log/i })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens the viewer panel on click', async () => {
    const user = userEvent.setup()
    render(<LogViewer />)
    await user.click(screen.getByRole('button', { name: /event log/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('renders entries newest-first with their message and context', async () => {
    log('info', 'first event')
    log('error', 'second event', { error: 'boom' })
    const user = userEvent.setup()
    render(<LogViewer />)

    await user.click(screen.getByRole('button', { name: /event log/i }))
    const items = screen.getAllByRole('listitem')
    expect(within(items[0]).getByText(/second event/)).toBeInTheDocument()
    expect(within(items[0]).getByText(/boom/)).toBeInTheDocument()
    expect(within(items[1]).getByText(/first event/)).toBeInTheDocument()
  })

  it('shows an empty state when there is nothing logged', async () => {
    const user = userEvent.setup()
    render(<LogViewer />)
    await user.click(screen.getByRole('button', { name: /event log/i }))
    expect(screen.getByText(/no log entries/i)).toBeInTheDocument()
  })

  it('Refresh re-reads the log so entries written after opening appear', async () => {
    const user = userEvent.setup()
    render(<LogViewer />)
    await user.click(screen.getByRole('button', { name: /event log/i }))
    expect(screen.getByText(/no log entries/i)).toBeInTheDocument()

    log('warn', 'late arrival')
    await user.click(screen.getByRole('button', { name: /refresh/i }))
    expect(screen.getByText(/late arrival/)).toBeInTheDocument()
  })

  it('can be closed again', async () => {
    const user = userEvent.setup()
    render(<LogViewer />)
    await user.click(screen.getByRole('button', { name: /event log/i }))
    await user.click(screen.getByRole('button', { name: /close/i }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
