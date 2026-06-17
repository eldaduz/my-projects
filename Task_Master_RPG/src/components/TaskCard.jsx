// ──────────────────────────────────────────────
// TaskCard.jsx — Single Quest Card Component
//
// Displays one quest with its title, priority badge,
// due date, XP value, and action buttons (edit / delete).
// Props are passed down from App → TaskCard.
// ──────────────────────────────────────────────

import { useState } from 'react';
import { Calendar, Pencil, Trash2, Check } from 'lucide-react';
import { formatDate } from '../utils/FormatDate.js';
import { XP_VALUES } from '../constants/gameConfig';

export default function TaskCard({
  task,
  onToggleComplete,
  onDeleteTask,
  onEditTask,
  isEditing,
  onSaveTask,
}) {
  const { title, priority, date } = task;

  // Tailwind class sets for each priority level.
  const priorityStyles = {
    High: 'bg-priority-high-bg text-priority-high border-priority-high',
    Medium: 'bg-priority-medium-bg text-priority-medium border-priority-medium',
    Low: 'bg-priority-low-bg text-priority-low border-priority-low',
  };

  // Check if the quest's due date is before today.
  // We compare date-only strings ("YYYY-MM-DD") to avoid
  // timezone issues between UTC and local time.
  function isTaskOverdue() {
    if (!date || task.completed) return false;

    const todayLocal = new Date();
    const todayStr = [
      todayLocal.getFullYear(),
      String(todayLocal.getMonth() + 1).padStart(2, '0'),
      String(todayLocal.getDate()).padStart(2, '0'),
    ].join('-');

    return date < todayStr;
  }

  const isOverdue = isTaskOverdue();

  // Local state for the inline title editor.
  const [editedTitle, setEditedTitle] = useState(title);

  return (
    <div
      className={`bg-surface-1 border border-border-stroke rounded-sm p-3 transition-all hover:border-purple-accent/50 ${
        isOverdue ? 'border-l-4 border-l-overdue-warning' : ''
      }`}
    >
      {/* Row: checkbox + quest content */}
      <div className="flex items-start gap-3">
        {/* Checkbox button */}
        <button
          data-testid="complete-checkbox"
          aria-label={
            task.completed ? `Mark "${title}" as incomplete` : `Mark "${title}" as complete`
          }
          onClick={() => onToggleComplete(task.id)}
          className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-1 transition-all ${
            task.completed
              ? 'bg-purple-accent border-purple-accent'
              : 'border-border-stroke hover:border-purple-accent'
          }`}
        >
          {task.completed && <Check className="w-3 h-3 text-white" />}
        </button>

        {/* Quest title + meta info */}
        <div className="flex-1 min-w-0">
          {/* Inline editing or static title */}
          {isEditing ? (
            <div className="flex items-center gap-2 mb-2">
              <input
                dir="auto"
                className="flex-1 bg-surface-2 border-2 border-purple-accent rounded px-2 py-1 text-text-primary outline-none"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onSaveTask(task.id, editedTitle)}
                autoFocus
              />
              <button
                onClick={() => onSaveTask(task.id, editedTitle)}
                className="p-1 hover:bg-surface-2 rounded text-green-500"
              >
                <Check className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <h3
              dir="auto"
              style={{ overflowWrap: 'break-word' }}
              className={`text-[14px] font-normal mb-2 ${
                task.completed ? 'text-text-secondary line-through' : 'text-text-primary'
              }`}
            >
              {title}
            </h3>
          )}

          {/* Priority badge + due date */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium ${
                priorityStyles[priority]
              }`}
            >
              {priority}
            </span>

            <div
              className={`flex items-center gap-1 text-[12px] ${
                isOverdue ? 'text-overdue-warning' : 'text-text-secondary'
              }`}
            >
              <Calendar className="w-3 h-3" />
              <span>{formatDate(date)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Row: XP value + edit/delete buttons */}
      <div className="mt-3 flex items-center justify-between gap-3 pl-8">
        <span className="text-[12px] font-medium text-purple-accent">
          +{XP_VALUES[priority] ?? 0} XP
        </span>

        <div className="flex items-center gap-1">
          <button
            aria-label={`Edit "${title}"`}
            onClick={() => onEditTask(task.id)}
            className="p-1 hover:bg-surface-2 rounded transition-colors text-text-secondary hover:text-text-primary"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            data-testid="delete-button"
            aria-label={`Delete "${title}"`}
            onClick={() => onDeleteTask(task.id)}
            className="p-1 hover:bg-surface-2 rounded transition-colors text-text-secondary hover:text-priority-high"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
