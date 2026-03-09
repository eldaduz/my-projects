import { useEffect, useRef } from 'react'

export default function ModalShell({ className, onClose, children }) {
  const shellRef = useRef(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onCloseRef.current?.()
    }
    document.addEventListener('keydown', handleKeyDown)

    // Move focus into modal on open
    const shell = shellRef.current
    const focusable = shell?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )
    if (focusable?.length) focusable[0].focus()

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
      ref={shellRef}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCloseRef.current?.()
      }}
    >
      <section
        className={`${className} modal-card`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {children}
      </section>
    </div>
  )
}
