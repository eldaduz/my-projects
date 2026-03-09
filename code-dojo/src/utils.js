export function formatFirestoreDate(value) {
  if (!value) return 'Pending'
  if (typeof value.toDate === 'function') return value.toDate().toLocaleString()
  return new Date(value).toLocaleString()
}
