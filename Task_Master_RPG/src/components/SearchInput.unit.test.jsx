import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SearchInput from './SearchInput'

describe('SearchInput', () => {
  it('renders controlled value', () => {
    render(<SearchInput value="dragon" onChange={vi.fn()} />)
    expect(screen.getByPlaceholderText(/Search quests/i)).toHaveValue('dragon')
  })

  it('calls onChange when user types', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<SearchInput value="" onChange={onChange} />)

    await user.type(screen.getByPlaceholderText(/Search quests/i), 'a')
    expect(onChange).toHaveBeenCalled()
  })
})
