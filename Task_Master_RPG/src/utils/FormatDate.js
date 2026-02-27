// ──────────────────────────────────────────────
// FormatDate.js — Date Display Utility
//
// Converts a stored date string from "YYYY-MM-DD"
// into "DD/MM/YYYY" for display in the UI.
// This is a pure utility function — no React or JSX.
// ──────────────────────────────────────────────

export function formatDate(rawDate) {
  if (!rawDate) {
    return ''
  }

  const parts = String(rawDate).split('-')
  if (parts.length !== 3) {
    return rawDate
  }

  const [year, month, day] = parts
  return `${day}/${month}/${year}`
}
