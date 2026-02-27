import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

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

// Mock SpeedInsights to prevent errors
vi.mock('@vercel/speed-insights/react', () => ({
  SpeedInsights: () => null,
}))
vi.mock('@vercel/analytics/react', () => ({
  Analytics: () => null,
}))

describe('Task Master RPG', () => {
  async function addQuest(user, { title, date = '31/12/2026', priority = 'Medium' }) {
    const titleInput = screen.getByPlaceholderText(/What is your next quest/i)
    const dateInput = screen.getByPlaceholderText(/dd\/mm\/yyyy/i)
    const prioritySelect = screen.getAllByRole('combobox')[0]
    const addButton = screen.getByRole('button', { name: /Add Quest/i })

    await user.type(titleInput, title)
    fireEvent.change(dateInput, { target: { value: date } })
    await user.selectOptions(prioritySelect, priority)
    await user.click(addButton)
  }

  beforeEach(() => {
    window.localStorage.clear()
    vi.clearAllMocks()
  })

  it('renders the initial app state correctly', () => {
    render(<App />)
    expect(screen.getByText(/Novice Adventurer/i)).toBeInTheDocument()
    expect(screen.getByText(/Level 1/i)).toBeInTheDocument()
    expect(screen.getByText(/Ready for Adventure\?/i)).toBeInTheDocument()
  })

  it('allows a user to add a new task', async () => {
    const user = userEvent.setup()
    render(<App />)

    await addQuest(user, { title: 'Defeat the Bug' })

    expect(screen.getByText('Defeat the Bug')).toBeInTheDocument()
  })

  it('shows validation when date is missing', async () => {
    const user = userEvent.setup()
    render(<App />)

    const titleInput = screen.getByPlaceholderText(/What is your next quest/i)
    const addButton = screen.getByRole('button', { name: /Add Quest/i })
    await user.type(titleInput, 'Missing Date Quest')
    await user.click(addButton)

    expect(screen.getByText(/Please select a due date/i)).toBeInTheDocument()
    expect(screen.queryByText('Missing Date Quest')).not.toBeInTheDocument()
  })

  it('awards XP when a High priority task is completed', async () => {
    const user = userEvent.setup()
    render(<App />)

    await addQuest(user, { title: 'Epic Boss Fight', priority: 'High' })
    await screen.findByText('Epic Boss Fight')

    const checkbox = screen.getByTestId('complete-checkbox')
    await user.click(checkbox)

    await waitFor(() => {
      expect(screen.getByText(/Level 2/i)).toBeInTheDocument()
    })
  })

  it('removes XP and level when a completed High task is unchecked', async () => {
    const user = userEvent.setup()
    render(<App />)

    await addQuest(user, { title: 'Backtrack Quest', priority: 'High' })
    const checkbox = screen.getByTestId('complete-checkbox')

    await user.click(checkbox)
    await waitFor(() => {
      expect(screen.getByText(/Level 2/i)).toBeInTheDocument()
    })

    await user.click(checkbox)
    await waitFor(() => {
      expect(screen.getByText(/Level 1/i)).toBeInTheDocument()
    })
  })

  it('filters completed and active tasks correctly', async () => {
    const user = userEvent.setup()
    window.localStorage.setItem(
      'quests',
      JSON.stringify([
        {
          id: 1,
          title: 'Completed Quest',
          priority: 'Medium',
          date: '2026-12-31',
          completed: true,
        },
        {
          id: 2,
          title: 'Active Quest',
          priority: 'Medium',
          date: '2026-12-31',
          completed: false,
        },
      ]),
    )
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Completed' }))
    expect(screen.getByText('Completed Quest')).toBeInTheDocument()
    expect(screen.queryByText('Active Quest')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Active' }))
    expect(screen.getByText('Active Quest')).toBeInTheDocument()
    expect(screen.queryByText('Completed Quest')).not.toBeInTheDocument()
  })

  it('filters quests by search term', async () => {
    const user = userEvent.setup()
    render(<App />)

    await addQuest(user, { title: 'Slay Dragon' })
    await addQuest(user, { title: 'Gather Herbs' })

    const searchInput = screen.getByPlaceholderText(/Search quests/i)
    await user.type(searchInput, 'dragon')

    expect(screen.getByText('Slay Dragon')).toBeInTheDocument()
    expect(screen.queryByText('Gather Herbs')).not.toBeInTheDocument()
  })

  it('sorts quests by deadline when selected', async () => {
    const user = userEvent.setup()
    render(<App />)

    await addQuest(user, { title: 'Late Quest', date: '31/12/2026' })
    await addQuest(user, { title: 'Early Quest', date: '01/01/2026' })

    const sortSelect = screen.getAllByRole('combobox')[1]
    await user.selectOptions(sortSelect, 'deadline')

    const titles = screen
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent)
    expect(titles[0]).toBe('Early Quest')
  })

  it('clears all completed quests when confirmed', async () => {
    const user = userEvent.setup()
    render(<App />)

    vi.mocked(window.confirm).mockReturnValue(true)
    await addQuest(user, { title: 'Done Quest' })

    await user.click(screen.getByTestId('complete-checkbox'))
    await user.click(screen.getByRole('button', { name: /Delete Finished Quests/i }))

    expect(screen.queryByText('Done Quest')).not.toBeInTheDocument()
    expect(screen.getByText(/All Quests Cleared/i)).toBeInTheDocument()
  })

  it('does not clear completed quests when confirmation is cancelled', async () => {
    const user = userEvent.setup()
    window.localStorage.setItem(
      'quests',
      JSON.stringify([
        {
          id: 'q-1',
          title: 'Protected Done Quest',
          priority: 'Medium',
          date: '2026-12-31',
          completed: true,
        },
      ]),
    )
    vi.mocked(window.confirm).mockReturnValue(false)

    render(<App />)
    await user.click(screen.getByRole('button', { name: /Delete Finished Quests/i }))

    expect(screen.getByText('Protected Done Quest')).toBeInTheDocument()
  })

  it('keeps tasks when delete modal is cancelled', async () => {
    const user = userEvent.setup()
    render(<App />)

    await addQuest(user, { title: 'Quest to Keep' })
    await screen.findByText('Quest to Keep')

    await user.click(screen.getByTestId('delete-button'))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByText('Quest to Keep')).toBeInTheDocument()
  })

  it('opens delete modal and deletes a task when confirmed', async () => {
    const user = userEvent.setup()
    render(<App />)

    await addQuest(user, { title: 'Task to Delete' })
    await screen.findByText('Task to Delete')

    const deleteBtn = screen.getByTestId('delete-button')
    await user.click(deleteBtn)

    expect(screen.getByText(/Are you sure/i)).toBeInTheDocument()

    const confirmBtn = screen.getByRole('button', { name: 'Delete' })
    await user.click(confirmBtn)

    expect(screen.queryByText('Task to Delete')).not.toBeInTheDocument()
  })

  it('hydrates initial tasks and user data from localStorage', () => {
    window.localStorage.setItem(
      'quests',
      JSON.stringify([
        {
          id: 1,
          title: 'Saved Quest',
          priority: 'Low',
          date: '2026-05-10',
          completed: false,
        },
      ]),
    )
    window.localStorage.setItem(
      'userData',
      JSON.stringify({
        level: 3,
        currentXP: 50,
        maxXP: 300,
        streak: 2,
        lastActiveDate: '10.5.2026',
      }),
    )

    render(<App />)

    expect(screen.getByText('Saved Quest')).toBeInTheDocument()
    expect(screen.getByText(/Level 3/i)).toBeInTheDocument()
    expect(screen.getByText(/Quest Ranger/i)).toBeInTheDocument()
    expect(screen.getByText(/2 Day Streak/i)).toBeInTheDocument()
  })

  it('falls back safely when localStorage contains malformed JSON', () => {
    window.localStorage.setItem('quests', '{bad-json')
    window.localStorage.setItem('userData', '{bad-json')

    render(<App />)

    expect(screen.getByText(/Level 1/i)).toBeInTheDocument()
    expect(screen.getByText(/Novice Adventurer/i)).toBeInTheDocument()
    expect(screen.getByText(/Ready for Adventure\?/i)).toBeInTheDocument()
  })
})
