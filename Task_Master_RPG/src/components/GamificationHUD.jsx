import { Flame, User } from 'lucide-react'

export default function GamificationHUD({ level, currentXP, maxXP, streak = 0, rankTitle }) {
  const xpPercentage = Math.min(100, (currentXP / maxXP) * 100)

  return (
    // Main div
    <div className="bg-surface-2 border border-border-stroke rounded-[16px] p-4 mb-6 shadow-lg">
      {/* Flex wrapper */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        {/* left cluster */}
        <div className="flex items-center gap-3">
          {/* user info */}
          <div className="w-11 h-11 rounded-full bg-surface-1 border border-border-stroke flex items-center justify-center shrink-0">
            <User className="w-5 h-5 text-purple-accent" />
          </div>
          {/* text info */}
          <div className="flex flex-col">
            <span className="text-[16px] font-semibold text-text-primary">Level {level}</span>
            <span className="text-[12px] text-text-secondary">{rankTitle}</span>
          </div>
        </div>
        {/* Center cluster */}
        <div className="flex flex-col gap-1 sm:flex-1 sm:max-w-md w-full">
          {/* text center info */}
          <div className="flex justify-between text-[12px] text-text-secondary">
            <span className="">XP Progress</span>
            <span>
              {currentXP} / {maxXP} XP
            </span>
          </div>
          {/* Bar track */}
          <div className="h-2.5 rounded-full bg-surface-1 overflow-hidden border border-border-stroke">
            {/* bar fill */}
            <div
              className="h-full bg-purple-accent rounded-full transition-all duration-300 ease-out"
              style={{ width: `${xpPercentage}%` }}
            />
          </div>
        </div>

        {/* Right cluster - Streak */}
        <div className="flex justify-end sm:justify-start">
          {/* badge pill */}
          <div className="flex items-center gap-2 bg-surface-1 border border-border-stroke rounded-full px-3 py-2">
            <Flame className="w-4 h-4 text-overdue-warning" />
            <span className="text-[12px] font-medium text-text-primary">{streak} Day Streak</span>
          </div>
        </div>
      </div>
    </div>
  )
}
