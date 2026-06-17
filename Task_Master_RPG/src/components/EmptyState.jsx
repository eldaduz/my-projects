// ──────────────────────────────────────────────
// EmptyState.jsx — Placeholder When No Quests
//
// Shows a different message depending on the situation:
//   1. Filters are hiding existing quests → "No Quests Found"
//   2. Brand-new user, no quests yet      → "Ready for Adventure?"
//   3. Veteran who cleared all quests     → "All Quests Cleared"
// ──────────────────────────────────────────────

import { CheckCircle } from 'lucide-react';

export default function EmptyState({ isNewUser, hasFiltersApplied }) {
  // Case 1: quests exist but the current filter hides them all.
  if (hasFiltersApplied) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <h2 className="text-[18px] font-semibold text-text-primary mb-2">No Quests Found</h2>
        <p className="text-[14px] text-text-secondary">Try adjusting your search or filters.</p>
      </div>
    );
  }

  // Case 2: first-time user with zero quests and zero XP.
  if (isNewUser) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <h2 className="text-[18px] font-semibold text-text-primary mb-2">Ready for Adventure?</h2>
        <p className="text-[14px] text-text-secondary">Create your first quest to begin! ⚔️</p>
      </div>
    );
  }

  // Case 3: experienced player who finished and removed all quests.
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <h2 className="text-[18px] font-semibold text-text-primary mb-2">All Quests Cleared</h2>
      <p className="text-[14px] text-text-secondary">Well done Adventurer 🧙‍♂️ 🐉</p>
    </div>
  );
}
