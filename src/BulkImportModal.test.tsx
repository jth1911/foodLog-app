import { describe, it, expect, vi } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BulkImportModal from './BulkImportModal'

const HEADER = 'Date,Meal Type,Food Description,Fat,Carbs,Protein,Calories,Fiber'

// Build a .csv File from rows of text.
function csvFile(...rows: string[]): File {
  const text = [HEADER, ...rows].join('\n')
  return new File([text], 'meals.csv', { type: 'text/csv' })
}

function renderModal() {
  const onImport = vi.fn()
  const onClose = vi.fn()
  render(<BulkImportModal onImport={onImport} onClose={onClose} />)
  return { onImport, onClose }
}

// The file input is hidden behind a label; grab it by its accessible label.
const fileInput = () => screen.getByLabelText(/choose.*csv|csv file/i) as HTMLInputElement

describe('BulkImportModal', () => {
  it('shows a summary of valid and error rows after a file is chosen', async () => {
    const user = userEvent.setup()
    renderModal()

    await user.upload(
      fileInput(),
      csvFile(
        '5/27/2026,Breakfast,Egg,5,1,6,70,0',
        '5/27/2026,Brunch,Mystery,1,1,1,1,1',
      ),
    )

    expect(await screen.findByText(/1 valid/i)).toBeInTheDocument()
    expect(screen.getByText(/1 error/i)).toBeInTheDocument()
    // The error reason and its row number are listed in the errors list.
    const list = screen.getByRole('list', { name: /errors/i })
    expect(within(list).getByText(/meal type/i)).toBeInTheDocument()
  })

  it('imports valid rows as stamped FoodEntry records on confirm', async () => {
    const user = userEvent.setup()
    const { onImport, onClose } = renderModal()

    await user.upload(fileInput(), csvFile('5/27/2026,Breakfast,Egg,5,1,6,70,0'))
    await screen.findByText(/1 valid/i)
    await user.click(screen.getByRole('button', { name: /import 1/i }))

    expect(onImport).toHaveBeenCalledTimes(1)
    const entries = onImport.mock.calls[0][0]
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      date: '2026-05-27',
      weekday: 'Wednesday',
      mealType: 'Breakfast',
      description: 'Egg',
      protein: 6,
    })
    // Stamped with an id and a numeric ISO week.
    expect(typeof entries[0].id).toBe('string')
    expect(typeof entries[0].week).toBe('number')
    expect(onClose).toHaveBeenCalled()
  })

  it('disables Import when there are no valid rows', async () => {
    const user = userEvent.setup()
    renderModal()

    await user.upload(fileInput(), csvFile('bad,row'))
    await screen.findByText(/0 valid/i)
    expect(screen.getByRole('button', { name: /import/i })).toBeDisabled()
  })

  it('closes on cancel without importing', async () => {
    const user = userEvent.setup()
    const { onImport, onClose } = renderModal()

    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onClose).toHaveBeenCalled()
    expect(onImport).not.toHaveBeenCalled()
  })

  it('lists multiple error reasons with their row numbers', async () => {
    const user = userEvent.setup()
    renderModal()

    await user.upload(
      fileInput(),
      csvFile('2/30/2026,Lunch,Egg,5,1,6,70,0', '5/27/2026,Lunch,Egg,abc,1,6,70,0'),
    )

    await waitFor(() => {
      const list = screen.getByRole('list', { name: /errors/i })
      expect(within(list).getAllByRole('listitem')).toHaveLength(2)
    })
  })
})
