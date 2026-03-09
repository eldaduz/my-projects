import { LEVELS as BASE_LEVELS } from '../lib/levels.js'

const FRONTEND_META = [
  { emoji: '🤍', color: 'var(--belt-white)' },
  { emoji: '💛', color: 'var(--belt-yellow)' },
  { emoji: '🧡', color: 'var(--belt-orange)' },
  { emoji: '💚', color: 'var(--belt-green)' },
  { emoji: '💙', color: 'var(--belt-blue)' },
  { emoji: '💜', color: 'var(--belt-purple)' },
  { emoji: '🤎', color: 'var(--belt-brown)' },
  { emoji: '❤️', color: 'var(--belt-red)' },
  { emoji: '🖤', color: 'var(--belt-black)' },
  { emoji: '⭐', color: 'var(--belt-master)' },
]

export const LEVELS = BASE_LEVELS.map((level, i) => ({
  ...level,
  ...FRONTEND_META[i],
}))

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
