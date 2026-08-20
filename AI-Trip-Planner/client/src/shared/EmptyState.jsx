export function EmptyState({ children }) {
  return (
    <div className="empty-state">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M4 19l5-11 5 11M6.5 14h5M14 19l3-7 3 7"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <p>{children}</p>
    </div>
  );
}
