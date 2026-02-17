import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'

export default function QuestInput({ onAddQuest }) {
  const [questTitle, setQuestTitle] = useState('')
  const [priority, setPriority] = useState('Medium')
  const [dueDate, setDueDate] = useState('')
  const [error, setError] = useState(false)

  function toStorageDate(date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const selectedDueDate = dueDate ? new Date(`${dueDate}T00:00:00`) : null

  function handleAdd() {
    if (!questTitle.trim() || !dueDate.trim()) {
      setError(true)
      return
    }

    onAddQuest({ title: questTitle, priority, date: dueDate })

    setQuestTitle('')
    setPriority('Medium')
    setDueDate('')
    setError(false)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <input
          dir="auto"
          className="quest-title w-full sm:flex-1"
          type="text"
          placeholder="What is your next quest? 🧙"
          value={questTitle}
          onChange={(e) => setQuestTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd()
          }}
        />
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

        <DatePicker
          wrapperClassName="w-full sm:w-auto"
          className={`quest-date w-full sm:w-36 text-center ${error ? 'border-priority-high' : ''}`}
          selected={selectedDueDate}
          minDate={new Date()}
          onChange={(selectedDate) => {
            if (!selectedDate) {
              setDueDate('')
              setError(false)
              return
            }
            setDueDate(toStorageDate(selectedDate))
            setError(false)
          }}
          dateFormat="dd/MM/yyyy"
          placeholderText="dd/mm/yyyy"
          showPopperArrow={false}
        />
        <button className="quest-button w-full sm:w-auto" onClick={handleAdd}>
          + Add Quest
        </button>
      </div>
      {error && (
        <span className="text-[12px] text-priority-high pl-1">
          Please select a due date for your quest!
        </span>
      )}
    </div>
  )
}
