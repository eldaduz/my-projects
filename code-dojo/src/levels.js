export const LEVELS = [
  { name: 'White Belt', xpRequired: 0, emoji: '🤍', color: 'var(--belt-white)' },
  { name: 'Yellow Belt', xpRequired: 120, emoji: '💛', color: 'var(--belt-yellow)' },
  { name: 'Orange Belt', xpRequired: 260, emoji: '🧡', color: 'var(--belt-orange)' },
  { name: 'Green Belt', xpRequired: 430, emoji: '💚', color: 'var(--belt-green)' },
  { name: 'Blue Belt', xpRequired: 620, emoji: '💙', color: 'var(--belt-blue)' },
  { name: 'Purple Belt', xpRequired: 840, emoji: '💜', color: 'var(--belt-purple)' },
  { name: 'Brown Belt', xpRequired: 1090, emoji: '🤎', color: 'var(--belt-brown)' },
  { name: 'Red Belt', xpRequired: 1370, emoji: '❤️', color: 'var(--belt-red)' },
  { name: 'Black Belt', xpRequired: 1680, emoji: '🖤', color: 'var(--belt-black)' },
  { name: 'Master Sensei', xpRequired: 2020, emoji: '⭐', color: 'var(--belt-master)' },
]

export function getLevelMeta(totalXp = 0) {
  let levelIndex = 0
  for (let index = 0; index < LEVELS.length; index += 1) {
    if (totalXp >= LEVELS[index].xpRequired) levelIndex = index
  }

  const current = LEVELS[levelIndex]
  const next = LEVELS[levelIndex + 1] ?? null
  const progress = next
    ? ((totalXp - current.xpRequired) / (next.xpRequired - current.xpRequired)) * 100
    : 100

  return {
    levelIndex,
    current,
    next,
    progress: Math.min(100, Math.max(0, progress)),
  }
}
