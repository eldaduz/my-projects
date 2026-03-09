import { useEffect, useRef } from 'react'

export default function ModalShell({ className = '', size = 'lg', onClose, children }) {
  const cardRef = useRef(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onCloseRef.current?.()
    }
    document.addEventListener('keydown', handleKeyDown)

    // Move focus into modal on open
    const card = cardRef.current
    const focusable = card?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )
    if (focusable?.length) focusable[0].focus()
    else card?.focus()

    // Prevent body scroll while modal is open
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [])

  return (
    <div
      className="modal-shell"
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCloseRef.current?.()
      }}
    >
      <section
        ref={cardRef}
        tabIndex={-1}
        className={`modal-card modal-card--${size} ${className}`.trim()}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {children}
      </section>
    </div>
  )
}
