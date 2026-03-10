import { LEVELS, getLevelMeta } from './levels'

export default function RankHoverCard({
  totalXp = 0,
  triggerClassName = '',
  triggerStyle,
  triggerLabel,
  triggerContent,
}) {
  const levelMeta = getLevelMeta(totalXp)
  const currentRank = levelMeta.current
  const nextRank = levelMeta.next
  const xpToNext = nextRank ? nextRank.xpRequired - totalXp : 0

  return (
    <div className="rank-hover">
      <button
        type="button"
        className={`rank-hover-trigger ${triggerClassName}`.trim()}
        style={triggerStyle}
        aria-label={triggerLabel}
      >
        {triggerContent}
      </button>

      <div className="rank-hover-card" role="tooltip">
        <div className="rank-hover-header">
          <strong>{currentRank.name}</strong>
          <span>{totalXp.toLocaleString()} XP</span>
        </div>
        <p className="rank-hover-copy">
          {nextRank ? `${xpToNext.toLocaleString()} XP to ${nextRank.name}` : 'Max rank reached'}
        </p>

        <div className="rank-hover-list">
          {LEVELS.map((level, index) => {
            const isCurrent = level.name === currentRank.name
            return (
              <div
                key={level.name}
                className={`rank-hover-row ${isCurrent ? 'current' : ''}`}
                style={{ '--belt-color': level.color }}
              >
                <div className="rank-hover-rank">
                  <span className="rank-hover-emoji" aria-hidden="true">
                    {level.emoji}
                  </span>
                  <span>{level.name}</span>
                </div>
                <span className="rank-hover-xp">
                  {level.xpRequired.toLocaleString()} XP
                  {index === 0 ? '' : '+'}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
