import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ModalQaHarness from './ModalQaHarness'
import { ThemeProvider } from './ThemeContext'

function renderHarness() {
  return render(
    <ThemeProvider>
      <ModalQaHarness />
    </ThemeProvider>,
  )
}

describe('Modal QA harness', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.setAttribute('data-theme', 'dark')
  })

  it('opens the exercise browser, updates filters, and closes on outside click', async () => {
    const user = userEvent.setup()
    renderHarness()

    await user.click(screen.getByRole('button', { name: 'Exercise Browser' }))

    expect(screen.getByRole('heading', { name: 'Choose your next challenge' })).toBeVisible()

    await user.type(screen.getByLabelText('Search'), 'Memoized')

    expect(screen.getByText('Memoized Fibonacci')).toBeVisible()
    expect(screen.queryByText('Group Todos by Status')).not.toBeInTheDocument()

    fireEvent.mouseDown(screen.getByRole('dialog'))

    expect(
      screen.queryByRole('heading', { name: 'Choose your next challenge' }),
    ).not.toBeInTheDocument()
  })

  it('keeps a modal open while switching theme and persists the new mode', async () => {
    const user = userEvent.setup()
    renderHarness()

    await user.click(screen.getByRole('button', { name: 'Settings' }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Appearance Review' })).toBeVisible()

    await user.click(within(dialog).getByRole('button', { name: 'Light Soft paper workspace' }))

    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(window.localStorage.getItem('codeDojo_theme')).toBe('light')
  })
})
