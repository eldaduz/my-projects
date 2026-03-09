import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider, getInitialTheme, useTheme } from './ThemeContext'

function ThemeProbe() {
  const { theme, toggleTheme } = useTheme()

  return (
    <div>
      <span data-testid="theme-value">{theme}</span>
      <button type="button" onClick={toggleTheme}>
        toggle theme
      </button>
    </div>
  )
}

describe('ThemeContext', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  it('initializes from localStorage when available', () => {
    window.localStorage.setItem('codeDojo_theme', 'light')

    expect(getInitialTheme()).toBe('light')
  })

  it('falls back to system preference', () => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query.includes('light'),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }))

    expect(getInitialTheme()).toBe('light')
  })

  it('writes the active theme to the document and localStorage', async () => {
    const user = userEvent.setup()

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    )

    expect(screen.getByTestId('theme-value')).toHaveTextContent('light')

    await user.click(screen.getByRole('button', { name: 'toggle theme' }))

    expect(screen.getByTestId('theme-value')).toHaveTextContent('dark')
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(window.localStorage.getItem('codeDojo_theme')).toBe('dark')
  })
})
