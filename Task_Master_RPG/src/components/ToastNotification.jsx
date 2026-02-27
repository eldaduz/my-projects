// ──────────────────────────────────────────────
// ToastNotification.jsx — Popup Message
//
// A small banner that slides in at the top of the
// screen to show a short message (e.g. "You are
// now a Quest Ranger!"). It disappears automatically
// after 2 seconds using useEffect + setTimeout.
// ──────────────────────────────────────────────

import { useEffect } from 'react'

export default function ToastNotification({ message, isVisible, onClose }) {
  // When the toast becomes visible, start a 2-second timer.
  // The cleanup function clears the timer if the component
  // unmounts or if isVisible changes before the timer fires.
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(onClose, 2000)
      return () => clearTimeout(timer)
    }
  }, [isVisible, onClose])

  // If not visible, render nothing.
  if (!isVisible) return null

  return (
    <div className="fixed top-4 p-4 left-1/2 -translate-x-1/2 z-50 bg-app-background rounded-xl border shadow-lg text-purple-accent">
      <p>{message}</p>
    </div>
  )
}
