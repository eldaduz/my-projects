export const LEVELS = [
  { name: 'White Belt', xpRequired: 0 },
  { name: 'Yellow Belt', xpRequired: 120 },
  { name: 'Orange Belt', xpRequired: 260 },
  { name: 'Green Belt', xpRequired: 430 },
  { name: 'Blue Belt', xpRequired: 620 },
  { name: 'Purple Belt', xpRequired: 840 },
  { name: 'Brown Belt', xpRequired: 1090 },
  { name: 'Red Belt', xpRequired: 1370 },
  { name: 'Black Belt', xpRequired: 1680 },
  { name: 'Master Sensei', xpRequired: 2020 },
]

export function getLevelFromXp(totalXp) {
  let index = 0
  for (let i = 0; i < LEVELS.length; i += 1) {
    if (totalXp >= LEVELS[i].xpRequired) index = i
  }
  return { index, name: LEVELS[index].name }
}
