import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import EmptyState from './EmptyState'

describe('EmptyState', () => {
  it('renders filtered state when hasFiltersApplied is true', () => {
    render(<EmptyState hasFiltersApplied={true} />)
    expect(screen.getByText('No Quests Found')).toBeInTheDocument()
    expect(screen.getByText(/Try adjusting your search or filters/i)).toBeInTheDocument()
  })

  it('renders new user state when isNewUser is true', () => {
    render(<EmptyState isNewUser={true} />)
    expect(screen.getByText('Ready for Adventure?')).toBeInTheDocument()
    expect(screen.getByText(/Create your first quest to begin/i)).toBeInTheDocument()
  })

  it('renders veteran state when neither condition matches (cleared all quests)', () => {
    render(<EmptyState isNewUser={false} hasFiltersApplied={false} />)
    expect(screen.getByText('All Quests Cleared')).toBeInTheDocument()
    expect(screen.getByText(/Well done Adventurer/i)).toBeInTheDocument()
  })
})
