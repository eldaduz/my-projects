// Spelled-out month avoids the mm/dd vs dd/mm ambiguity of a numeric date.
export function formatDate(isoDate, options = {}) {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
    ...options,
  });
}
