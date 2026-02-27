// ──────────────────────────────────────────────
// QuestInput.jsx — New Quest Form Component
//
// A form with three fields: title, priority, and
// due date. Validates that both title and date are
// filled before submitting. After a successful add,
// the fields reset to their defaults.
// ──────────────────────────────────────────────

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'

export default function QuestInput({ onAddQuest }) {
  // Each field has its own state managed by useState.
  const [questTitle, setQuestTitle] = useState('')
  const [priority, setPriority] = useState('Medium')
  const [dueDate, setDueDate] = useState('')
  const [errors, setErrors] = useState({ title: false, dueDate: false })

  // Convert a Date object into the "YYYY-MM-DD" format we store.
  function toStorageDate(date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Reconstruct a Date object for the DatePicker.
  const selectedDueDate = dueDate ? new Date(`${dueDate}T00:00:00`) : null

  // Validate and submit the form.
  function handleAdd() {
    const titleMissing = !questTitle.trim()
    const dueDateMissing = !dueDate.trim()

    if (titleMissing || dueDateMissing) {
      setErrors({ title: titleMissing, dueDate: dueDateMissing })
      return
    }

    // Call the parent's handler (App → useTaskManager → addTask).
    onAddQuest({ title: questTitle, priority, date: dueDate })

    // Reset all fields for the next quest.
    setQuestTitle('')
    setPriority('Medium')
    setDueDate('')
    setErrors({ title: false, dueDate: false })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Quest title input */}
        <input
          dir="auto"
          className={`quest-title w-full sm:flex-1 ${errors.title ? 'border-priority-high' : ''}`}
          type="text"
          placeholder="What is your next quest? 🧙"
          value={questTitle}
          onChange={(e) => {
            setQuestTitle(e.target.value)
            if (errors.title) {
              setErrors((prev) => ({ ...prev, title: false }))
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd()
          }}
        />

        {/* Priority dropdown */}
        <div className="relative w-full sm:w-auto">
          <select
            className="quest-select w-full sm:w-auto appearance-none pr-10 cursor-pointer"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            <option value={'Low'}>Low</option>
            <option value={'Medium'}>Medium</option>
            <option value={'High'}>High</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" />
        </div>

        {/* Due date picker (react-datepicker library) */}
        <DatePicker
          wrapperClassName="w-full sm:w-auto"
          className={`quest-date w-full sm:w-36 text-center ${errors.dueDate ? 'border-priority-high' : ''}`}
          selected={selectedDueDate}
          minDate={new Date()}
          onChange={(selectedDate) => {
            if (!selectedDate) {
              setDueDate('')
              return
            }
            setDueDate(toStorageDate(selectedDate))
            if (errors.dueDate) {
              setErrors((prev) => ({ ...prev, dueDate: false }))
            }
          }}
          dateFormat="dd/MM/yyyy"
          placeholderText="dd/mm/yyyy"
          showPopperArrow={false}
        />

        {/* Submit button */}
        <button className="quest-button w-full sm:w-auto" onClick={handleAdd}>
          + Add Quest
        </button>
      </div>

      {/* Validation error messages */}
      {errors.title && (
        <span className="text-[12px] text-priority-high pl-1">Please enter a quest title.</span>
      )}
      {errors.dueDate && (
        <span className="text-[12px] text-priority-high pl-1">
          Please select a due date for your quest!
        </span>
      )}
    </div>
  )
}
