import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'

const ThemeContext = createContext(null)

export function getInitialTheme() {
  if (typeof window === 'undefined') return 'dark'

  const savedTheme = window.localStorage.getItem('codeDojo_theme')
  if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme

  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getInitialTheme)
  const switchTimerRef = useRef(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('codeDojo_theme', theme)
  }, [theme])

  useEffect(
    () => () => {
      if (switchTimerRef.current) {
        window.clearTimeout(switchTimerRef.current)
      }
    },
    [],
  )

  const setTheme = (nextThemeOrUpdater) => {
    const applyTheme = () => {
      setThemeState((currentTheme) =>
        typeof nextThemeOrUpdater === 'function'
          ? nextThemeOrUpdater(currentTheme)
          : nextThemeOrUpdater,
      )
    }

    const root = document.documentElement
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    root.setAttribute('data-theme-switching', 'true')
    if (switchTimerRef.current) window.clearTimeout(switchTimerRef.current)

    if (!prefersReducedMotion && typeof document.startViewTransition === 'function') {
      document.startViewTransition(applyTheme)
    } else {
      applyTheme()
    }

    switchTimerRef.current = window.setTimeout(
      () => {
        root.removeAttribute('data-theme-switching')
      },
      prefersReducedMotion ? 0 : 240,
    )
  }

  const value = useMemo(
    () => ({
      theme,
      toggleTheme: () => setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark')),
      setTheme,
    }),
    [theme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within ThemeProvider')
  return context
}
