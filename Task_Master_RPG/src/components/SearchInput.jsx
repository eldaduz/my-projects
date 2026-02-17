export default function SearchInput({ value, onChange }) {
  return (
    <div className="search-bar">
      <span>🔍</span>
      <input
        dir="auto"
        className="search-input"
        placeholder="Search quests..."
        value={value}
        onChange={onChange}
      />
    </div>
  )
}
