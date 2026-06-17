// ──────────────────────────────────────────────
// SearchInput.jsx — Search Bar Component
//
// A controlled input that lets the user filter
// quests by typing. The parent (App) owns the
// search value via props (value + onChange).
// ──────────────────────────────────────────────

export default function SearchInput({ value, onChange }) {
  return (
    <div className="search-bar">
      <span>🔍</span>
      <input
        dir="auto"
        aria-label="Search quests"
        className="search-input"
        placeholder="Search quests..."
        value={value}
        onChange={onChange}
      />
    </div>
  );
}
