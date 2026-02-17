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
