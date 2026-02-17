import { useEffect } from 'react'

export default function ToastNotification({ message, isVisible, onClose }) {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(onClose, 2000)
      return () => clearTimeout(timer)
    }
  }, [isVisible, onClose])

  if (!isVisible) return null
  return (
    <div className="fixed top-4 p-4 left-1/2 -translate-x-1/2 z-50 bg-app-background rounded-xl border shadow-lg text-purple-accent">
      <p>{message}</p>
    </div>
  )
}
