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
