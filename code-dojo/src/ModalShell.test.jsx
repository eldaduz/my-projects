import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ModalShell from './ModalShell'

describe('ModalShell', () => {
  it('renders children and closes on backdrop click', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()

    render(
      <ModalShell onClose={onClose}>
        <button type="button">Inside modal</button>
      </ModalShell>,
    )

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Inside modal' })).toBeVisible()

    fireEvent.mouseDown(screen.getByRole('dialog'))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not close when clicking inside the modal card', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()

    render(
      <ModalShell onClose={onClose}>
        <button type="button">Do not close</button>
      </ModalShell>,
    )

    await user.click(screen.getByRole('button', { name: 'Do not close' }))

    expect(onClose).not.toHaveBeenCalled()
  })
})
