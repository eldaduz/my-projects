import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DeleteModal from './DeleteModal'

describe('DeleteModal', () => {
  it('does not render when closed', () => {
    render(
      <DeleteModal isOpen={false} taskTitle="Quest A" onConfirm={vi.fn()} onCancel={vi.fn()} />,
    )

    expect(screen.queryByText(/Delete Quest/i)).not.toBeInTheDocument()
  })

  it('renders title and task name when open', () => {
    render(<DeleteModal isOpen={true} taskTitle="Quest A" onConfirm={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.getByText(/Delete Quest/i)).toBeInTheDocument()
    expect(screen.getByText('Quest A')).toBeInTheDocument()
  })

  it('calls onConfirm when Delete is clicked', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(
      <DeleteModal isOpen={true} taskTitle="Quest A" onConfirm={onConfirm} onCancel={vi.fn()} />,
    )

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('calls onCancel when Cancel is clicked', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(
      <DeleteModal isOpen={true} taskTitle="Quest A" onConfirm={vi.fn()} onCancel={onCancel} />,
    )

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
