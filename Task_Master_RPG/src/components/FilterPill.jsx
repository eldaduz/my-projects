// ──────────────────────────────────────────────
// FilterPill.jsx — Filter Tab Button
//
// A small pill-shaped button used for the
// "All / Active / Completed" filter bar.
// The active pill gets highlighted styling.
// ──────────────────────────────────────────────

export default function FilterPill({ label, isActive, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`filter-pill ${isActive ? 'filter-pill--active' : 'filter-pill--inactive'}`}
    >
      {label}
    </button>
  )
}
