import { useState } from 'react'
import { Calendar, Pencil, Trash2, Check } from 'lucide-react'
import { formatDate } from '../utils/FormatDate'

export default function TaskCard({
  task,
  onToggleComplete,
  onDeleteTask,
  onEditTask,
  isEditing,
  onSaveTask,
}) {
  const { title, priority, date } = task

  function getXP() {
    switch (priority) {
      case 'Low':
        return 25
      case 'Medium':
        return 50
      case 'High':
        return 100
      default:
        return 0
    }
  }

  // Priority Styles Map
  const priorityStyles = {
    High: 'bg-priority-high-bg text-priority-high border-priority-high',
    Medium: 'bg-priority-medium-bg text-priority-medium border-priority-medium',
    Low: 'bg-priority-low-bg text-priority-low border-priority-low',
  }

  const isOverdue = new Date(date) < new Date() && !task.completed

  const [editedTitle, setEditedTitle] = useState(title)

  return (
    <div
      className={`bg-surface-1 border border-border-stroke rounded-sm p-3 transition-all hover:border-purple-accent/50 ${
        isOverdue ? 'border-l-4 border-l-overdue-warning' : ''
      }`}
    >
      {/* Top Row: Checkbox + Content */}
      <div className="flex items-start gap-3">
        {/* Custom Checkbox Button */}
        <button
          onClick={() => onToggleComplete(task.id)}
          className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-1 transition-all ${
            task.completed
              ? 'bg-purple-accent border-purple-accent'
              : 'border-border-stroke hover:border-purple-accent'
          }`}
        >
          {task.completed && <Check className="w-3 h-3 text-white" />}
        </button>

        {/* Content Column */}
        <div className="flex-1 min-w-0">
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

          {/* Meta Row: Priority Pill + Date */}
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

      {/* Bottom Row: XP + Actions */}
      <div className="mt-3 flex items-center justify-between gap-3 pl-8">
        <span className="text-[12px] font-medium text-purple-accent">+{getXP()} XP</span>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onEditTask(task.id)}
            className="p-1 hover:bg-surface-2 rounded transition-colors text-text-secondary hover:text-text-primary"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDeleteTask(task.id)}
            className="p-1 hover:bg-surface-2 rounded transition-colors text-text-secondary hover:text-priority-high"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
