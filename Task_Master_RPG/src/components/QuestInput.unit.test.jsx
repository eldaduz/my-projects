import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import QuestInput from './QuestInput'

vi.mock('react-datepicker', () => ({
  default: ({ onChange, placeholderText, className }) => (
    <input
      placeholder={placeholderText}
      className={className}
      onChange={(e) => {
        const [day, month, year] = e.target.value.split('/')
        if (day && month && year) {
          onChange(new Date(Number(year), Number(month) - 1, Number(day)))
        } else {
          onChange(null)
        }
      }}
    />
  ),
}))

describe('QuestInput', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows validation and does not submit when date is missing', async () => {
    const user = userEvent.setup()
    const onAddQuest = vi.fn()
    render(<QuestInput onAddQuest={onAddQuest} />)

    await user.type(screen.getByPlaceholderText(/What is your next quest/i), 'No Date Quest')
    await user.click(screen.getByRole('button', { name: /Add Quest/i }))

    expect(onAddQuest).not.toHaveBeenCalled()
    expect(screen.getByText(/Please select a due date/i)).toBeInTheDocument()
  })

  it('submits normalized quest payload and resets form', async () => {
    const user = userEvent.setup()
    const onAddQuest = vi.fn()
    render(<QuestInput onAddQuest={onAddQuest} />)

    const titleInput = screen.getByPlaceholderText(/What is your next quest/i)
    const dateInput = screen.getByPlaceholderText(/dd\/mm\/yyyy/i)
    const prioritySelect = screen.getByRole('combobox')

    await user.type(titleInput, 'Write Unit Tests')
    await user.selectOptions(prioritySelect, 'High')
    fireEvent.change(dateInput, { target: { value: '05/08/2027' } })
    await user.click(screen.getByRole('button', { name: /Add Quest/i }))

    expect(onAddQuest).toHaveBeenCalledWith({
      title: 'Write Unit Tests',
      priority: 'High',
      date: '2027-08-05',
    })
    expect(titleInput).toHaveValue('')
    expect(prioritySelect).toHaveValue('Medium')
  })

  it('submits on Enter key from title input', async () => {
    const user = userEvent.setup()
    const onAddQuest = vi.fn()
    render(<QuestInput onAddQuest={onAddQuest} />)

    const titleInput = screen.getByPlaceholderText(/What is your next quest/i)
    const dateInput = screen.getByPlaceholderText(/dd\/mm\/yyyy/i)
    fireEvent.change(dateInput, { target: { value: '11/11/2027' } })

    await user.type(titleInput, 'Enter Submit Quest{Enter}')

    expect(onAddQuest).toHaveBeenCalledWith({
      title: 'Enter Submit Quest',
      priority: 'Medium',
      date: '2027-11-11',
    })
  })
})
