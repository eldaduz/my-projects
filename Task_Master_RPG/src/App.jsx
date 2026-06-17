// ──────────────────────────────────────────────
// App.jsx — Root Component
//
// This is the top-level component that React renders.
// It is responsible for:
//   1. User progress (level, XP, streak)
//   2. Toast notifications (short popup messages)
//   3. Wiring child components together
//
// All task-related logic is handled by the
// useTaskManager custom hook (see hooks/useTaskManager.js).
// This keeps App short and focused on the UI layout.
// ──────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { Analytics } from '@vercel/analytics/react';
import { ChevronDown } from 'lucide-react';
import FilterPill from './components/FilterPill';
import SearchInput from './components/SearchInput';
import QuestInput from './components/QuestInput';
import TaskCard from './components/TaskCard';
import DeleteModal from './components/DeleteModal';
import GamificationHUD from './components/GamificationHUD';
import ToastNotification from './components/ToastNotification';
import EmptyState from './components/EmptyState';
import useTaskManager from './hooks/useTaskManager';
import { XP_VALUES, RANK_TITLES, DEFAULT_USER_DATA, APP_TIMEZONE } from './constants/gameConfig';

// Load user progress from localStorage when the app starts.
// If the saved data is missing or broken, return default values.
function loadUserData() {
  try {
    const savedUser = localStorage.getItem('userData');
    return savedUser ? JSON.parse(savedUser) : DEFAULT_USER_DATA;
  } catch {
    return DEFAULT_USER_DATA;
  }
}

export default function App() {
  // ── Toast State ───────────────────────────────
  // A small popup message that appears briefly after an event
  // (e.g. "You are now a Quest Ranger!").

  const [toast, setToast] = useState({
    message: 'You have successfully promoted to the next rank',
    show: false,
  });

  // useCallback keeps a stable function reference.
  // We pass these to child components, so a stable reference
  // prevents unnecessary re-renders.
  const showToast = useCallback((message) => {
    setToast({ message, show: true });
  }, []);

  const closeToast = useCallback(() => {
    setToast((prev) => ({ ...prev, show: false }));
  }, []);

  // ── User Progress State ───────────────────────
  // Tracks level, XP, streak, and last active date.
  const [userData, setUserData] = useState(loadUserData);

  // Called every time a quest is completed or un-completed.
  // Decides how much XP to add/remove, whether to level up/down,
  // and whether the daily streak should increase.
  const handleTaskCompletionChange = useCallback(
    (task, willComplete) => {
      const xpValue = XP_VALUES[task.priority] ?? 0;
      const xpDelta = willComplete ? xpValue : -xpValue;

      setUserData((prevUser) => {
        let newXP = prevUser.currentXP + xpDelta;
        let newLevel = prevUser.level;
        let newMaxXP = prevUser.maxXP;
        let newLastActiveDate = prevUser.lastActiveDate;
        let newStreak = prevUser.streak;

        // ── Level Up ──
        if (newXP >= newMaxXP) {
          const newRankTitle = RANK_TITLES[Math.min(newLevel, RANK_TITLES.length - 1)];
          newXP -= newMaxXP;
          newLevel += 1;
          newMaxXP = newLevel * 100;

          // Try to play the level-up sound.
          // Some browsers block auto-play, so we catch the error.
          try {
            const maybePromise = new Audio('/levelup.mp3').play();
            if (maybePromise && typeof maybePromise.catch === 'function') {
              maybePromise.catch(() => {
                console.warn('Level-up sound playback was blocked by the browser.');
              });
            }
          } catch {
            console.warn('Failed to play level-up sound.');
          }

          showToast(`You are now a ${newRankTitle}!`);

          // ── Level Down (XP went negative) ──
        } else if (newXP < 0) {
          if (newLevel > 1) {
            newLevel -= 1;
            newMaxXP = newLevel * 100;
            newXP = newMaxXP + newXP;
          } else {
            newXP = 0;
          }
        }

        // ── Streak Logic ──
        // Only count streak when completing a quest (not un-completing).
        if (xpDelta > 0) {
          const options = { timeZone: APP_TIMEZONE };
          const today = new Date().toLocaleDateString('he-IL', options);
          const yesterdayObj = new Date();
          yesterdayObj.setDate(yesterdayObj.getDate() - 1);
          const yesterday = yesterdayObj.toLocaleDateString('he-IL', options);

          if (prevUser.lastActiveDate === yesterday) {
            newStreak += 1; // consecutive day → streak grows
          } else if (prevUser.lastActiveDate !== today) {
            newStreak = 1; // streak broken → reset to 1
          }

          newLastActiveDate = today;
        }

        return {
          ...prevUser,
          level: newLevel,
          currentXP: newXP,
          maxXP: newMaxXP,
          streak: newStreak,
          lastActiveDate: newLastActiveDate,
        };
      });
    },
    [showToast],
  );

  // ── Custom Hook ───────────────────────────────
  // useTaskManager returns all the task data and actions
  // we need. We pass it two callbacks so it can notify us
  // about XP changes and show toast messages.
  const {
    tasks,
    filteredTasks,
    filter,
    setFilter,
    searchTerm,
    setSearchTerm,
    sortBy,
    setSortBy,
    editingTaskID,
    isDeleteModalOpen,
    taskToDelete,
    addTask,
    clearCompleted,
    toggleTaskComplete,
    requestDelete,
    confirmDelete,
    cancelDelete,
    editTask,
    saveTask,
  } = useTaskManager({
    onTaskCompletionChange: handleTaskCompletionChange,
    showToast,
  });

  // ── Side Effect: persist user progress ────────
  // Every time userData changes, save it to localStorage.
  useEffect(() => {
    try {
      localStorage.setItem('userData', JSON.stringify(userData));
    } catch {
      console.warn('Failed to save userData to localStorage.');
    }
  }, [userData]);

  // Pick the correct rank title for the current level.
  const currentRank = RANK_TITLES[Math.min(userData.level - 1, RANK_TITLES.length - 1)];

  // ── JSX (UI Layout) ──────────────────────────
  return (
    <div className="min-h-screen bg-app-background py-6">
      <div className="mx-auto max-w-260 px-4 sm:px-6">
        {/* Player stats bar at the top */}
        <GamificationHUD
          level={userData.level}
          currentXP={userData.currentXP}
          maxXP={userData.maxXP}
          streak={userData.streak}
          rankTitle={currentRank}
        />

        {/* Input form to create a new quest */}
        <div className="mb-8">
          <QuestInput onAddQuest={addTask} />
        </div>

        {/* Filter tabs + sort dropdown + search bar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div
            className="flex items-center gap-2 overflow-x-auto pb-1"
            role="group"
            aria-label="Filter quests by status"
          >
            <FilterPill
              label={'All'}
              isActive={filter === 'All'}
              onClick={() => setFilter('All')}
            />
            <FilterPill
              label={'Active'}
              isActive={filter === 'Active'}
              onClick={() => setFilter('Active')}
            />
            <FilterPill
              label={'Completed'}
              isActive={filter === 'Completed'}
              onClick={() => setFilter('Completed')}
            />
            {tasks.some((task) => task.completed) && (
              <button
                onClick={clearCompleted}
                className="ml-2 text-[12px] font-medium text-text-secondary hover:text-priority-high transition-colors whitespace-nowrap"
              >
                Delete Finished Quests
              </button>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative w-full sm:w-auto">
              <select
                aria-label="Sort quests"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full sm:w-auto h-10 rounded-md border border-border-stroke bg-surface-1 text-text-primary px-3 pr-10 appearance-none cursor-pointer focus:outline-none focus:border-purple-accent transition-colors"
              >
                <option value={'priority'}>Sort: Priority</option>
                <option value={'deadline'}>Sort: Deadline</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" />
            </div>
            <SearchInput value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </div>

        {/* Quest list — or an empty-state message if there are none */}
        {filteredTasks.length >= 1 ? (
          filteredTasks.map((task) => (
            <TaskCard
              task={task}
              key={task.id}
              onToggleComplete={toggleTaskComplete}
              onDeleteTask={requestDelete}
              onEditTask={editTask}
              isEditing={task.id === editingTaskID}
              onSaveTask={saveTask}
            />
          ))
        ) : (
          <EmptyState
            isNewUser={userData.level === 1 && userData.currentXP === 0}
            hasFiltersApplied={tasks.length > 0}
          />
        )}

        {/* Delete confirmation modal (only visible when triggered) */}
        <DeleteModal
          isOpen={isDeleteModalOpen}
          taskTitle={taskToDelete?.title}
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
        />

        {/* Toast popup — auto-hides after 2 seconds */}
        <ToastNotification message={toast.message} isVisible={toast.show} onClose={closeToast} />
      </div>

      {/* Vercel analytics (production only) */}
      <SpeedInsights />
      <Analytics />
    </div>
  );
}
