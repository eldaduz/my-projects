import { useState, useEffect } from 'react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { Analytics } from '@vercel/analytics/react'
import { ChevronDown } from 'lucide-react'
import FilterPill from './components/FilterPill'
import SearchInput from './components/SearchInput'
import QuestInput from './components/QuestInput'
import TaskCard from './components/TaskCard'
import DeleteModal from './components/DeleteModal'
import GamificationHUD from './components/GamificationHUD'
import ToastNotification from './components/ToastNotification'
import EmptyState from './components/EmptyState'

// Calculator for XP values:
const XP_VALUES = { High: 100, Medium: 50, Low: 25 }

// Ranking titles:
const RANK_TITLES = [
  'Novice Adventurer',
  'Scroll Apprentice',
  'Quest Ranger',
  'Knight of the Realm',
  'Dungeon Raider',
  'Archmage of Focus',
  'Grand Paladin',
  'Dragon Slayer',
  'Demi-God',
  'The Task Master',
]

export default function App() {
  // elements useState for different components:
  // useState for FilterPill:
  const [filter, setFilter] = useState('All')
  // useState for SearchInput:
  const [searchTerm, setSearchTerm] = useState('')
  // useState for TaskCard:
  const [tasks, setTasks] = useState(() => {
    try {
      const savedData = localStorage.getItem('quests')
      if (!savedData) return []
      const parsedData = JSON.parse(savedData)
      return Array.isArray(parsedData) ? parsedData : []
    } catch {
      return []
    }
  })
  // useState for sorting by priority:
  const [sortBy, setSortBy] = useState('priority')

  // elements for filtering results by status & search:
  const filteredTasks = tasks
    .filter((task) => {
      let statusMatch = true
      if (filter === 'All') {
        statusMatch = true
      } else if (filter === 'Active') {
        statusMatch = !task.completed
      } else if (filter === 'Completed') {
        statusMatch = task.completed
      }
      const matchSearch = (task.title?.toLowerCase() ?? '').includes(searchTerm.toLowerCase())

      return statusMatch && matchSearch
    })
    .sort((a, b) => {
      if (sortBy === 'priority') {
        return XP_VALUES[b.priority] - XP_VALUES[a.priority]
      } else if (sortBy === 'deadline') {
        if (!a.date) return 1
        if (!b.date) return -1
        return new Date(a.date) - new Date(b.date)
      }
      return 0
    })

  // useState for editing a task:
  const [editingTaskID, setEditingTaskID] = useState(null)

  // useState for deleting modal:
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [taskToDelete, setTaskToDelete] = useState(null)

  //function to clear completed tasks
  function clearCompleted() {
    const userConfirm = window.confirm('Are you sure you want to delete all completed quests?')
    if (userConfirm) {
      setTasks((prevTasks) => prevTasks.filter((task) => !task.completed))
      showToast('All completed quests are deleted')
    }
  }

  // functions for adding/deleting/editing/completed/saving edited quests(tasks):

  // function for adding a task:
  function addTask(questData) {
    const newTask = {
      id: Date.now(),
      completed: false,
      ...questData,
    }
    setTasks((prevTasks) => [...prevTasks, newTask])
  }
  // function for flagging a task as completed and calculating the XP and the new level requirement :
  // function for flagging a task as completed:

  function toggleTaskComplete(taskId) {
    // 1. Find the task to get its details
    const task = tasks.find((t) => t.id === taskId)

    // 2. If the task exists + setUserData
    if (task) {
      const xpChange = task.completed ? -XP_VALUES[task.priority] : XP_VALUES[task.priority]

      setUserData((prevUser) => {
        let newXP = prevUser.currentXP + xpChange
        let newLevel = prevUser.level
        let newMaxXP = prevUser.maxXP
        let newLastActiveDate = prevUser.lastActiveDate
        let newStreak = prevUser.streak

        // Level Up Logic
        if (newXP >= newMaxXP) {
          const newRankTitle = RANK_TITLES[Math.min(newLevel, RANK_TITLES.length - 1)]
          newXP = newXP - newMaxXP // Carry over extra XP
          newLevel += 1
          newMaxXP = newLevel * 100 // New target: Level * 100
          new Audio('/levelup.mp3').play()
          showToast(`You are now a ${newRankTitle}!`)
        } else if (newXP < 0) {
          if (newLevel > 1) {
            newLevel -= 1
            newMaxXP = newLevel * 100
            newXP = newMaxXP + newXP // Subtract negative XP from new max
          } else {
            newXP = 0
          }
        }
        if (xpChange > 0) {
          const lastActiveDate = prevUser.lastActiveDate
          const options = { timeZone: 'Asia/Jerusalem' }
          const today = new Date().toLocaleDateString('he-IL', options)
          const yesterdayObj = new Date()
          yesterdayObj.setDate(yesterdayObj.getDate() - 1)
          const yesterday = yesterdayObj.toLocaleDateString('he-IL', options)
          if (lastActiveDate === yesterday) {
            newStreak += 1
          } else if (lastActiveDate !== today) {
            newStreak = 1
          }
          newLastActiveDate = today
        }

        return {
          ...prevUser,
          level: newLevel,
          currentXP: newXP,
          maxXP: newMaxXP,
          streak: newStreak,
          lastActiveDate: newLastActiveDate,
        }
      })
    }

    // 3. Update the tasks state (toggle the checkbox)
    setTasks((prevTasks) =>
      prevTasks.map((t) => (t.id === taskId ? { ...t, completed: !t.completed } : t)),
    )
  }

  // function for deleting a task:

  function requestDelete(id) {
    const task = tasks.find((t) => t.id === id)
    setTaskToDelete(task)
    setIsDeleteModalOpen(true)
  }

  function confirmDelete() {
    setTasks((prevTasks) => prevTasks.filter((task) => task.id !== taskToDelete.id))
    setTaskToDelete(null)
    setIsDeleteModalOpen(false)
  }
  // function for editing a task:

  function editTask(taskId) {
    setEditingTaskID(taskId)
  }
  // function for saving a task after editing:

  function saveTasks(taskId, newTitle) {
    setTasks((prevTasks) =>
      prevTasks.map((task) => (task.id === taskId ? { ...task, title: newTitle } : task)),
    )
    setEditingTaskID(null)
  }

  // useState for User data:
  const [userData, setUserData] = useState(() => {
    try {
      const savedUser = localStorage.getItem('userData')
      return savedUser
        ? JSON.parse(savedUser)
        : {
            level: 1,
            currentXP: 0,
            maxXP: 100,
            streak: 0,
            lastActiveDate: null,
          }
    } catch {
      return { level: 1, currentXP: 0, maxXP: 100, streak: 0, lastActiveDate: null }
    }
  })

  // useEffect for saving the quests and user data:
  useEffect(() => {
    localStorage.setItem('userData', JSON.stringify(userData))
  }, [userData])

  useEffect(() => {
    const jsonString = JSON.stringify(tasks)
    localStorage.setItem('quests', jsonString)
  }, [tasks])

  // useState for ToastMessage:
  const [toast, setToast] = useState({
    message: 'You have successfully promoted to the next rank',
    show: false,
  })

  //function for toast message:
  function showToast(message) {
    setToast({ message, show: true })
  }
  function closeToast() {
    setToast((prev) => ({ ...prev, show: false }))
  }
  const currentRank = RANK_TITLES[Math.min(userData.level - 1, RANK_TITLES.length - 1)]

  return (
    <div className="min-h-screen bg-app-background py-6">
      {/* inner div  */}
      <div className="mx-auto max-w-260 px-4 sm:px-6">
        <GamificationHUD
          level={userData.level}
          currentXP={userData.currentXP}
          maxXP={userData.maxXP}
          streak={userData.streak}
          rankTitle={currentRank}
        />
        <div className="mb-8">
          <QuestInput onAddQuest={addTask} />
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          {/* Left: Filters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
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
            {tasks.some((t) => t.completed) && (
              <button
                onClick={clearCompleted}
                className="ml-2 text-[12px] font-medium text-text-secondary hover:text-priority-high transition-colors whitespace-nowrap"
              >
                Delete Finished Quests
              </button>
            )}
          </div>

          {/* Right: Sort & Search */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative w-full sm:w-auto">
              <select
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
        {filteredTasks.length >= 1 ? (
          filteredTasks.map((task) => (
            <TaskCard
              task={task}
              key={task.id}
              onToggleComplete={toggleTaskComplete}
              onDeleteTask={requestDelete}
              onEditTask={editTask}
              isEditing={task.id === editingTaskID}
              onSaveTask={saveTasks}
            />
          ))
        ) : (
          <EmptyState />
        )}
        <DeleteModal
          isOpen={isDeleteModalOpen}
          taskTitle={taskToDelete?.title}
          onConfirm={confirmDelete}
          onCancel={() => {
            setIsDeleteModalOpen(false)
            setTaskToDelete(null)
          }}
        />
        <ToastNotification message={toast.message} isVisible={toast.show} onClose={closeToast} />
      </div>
      <SpeedInsights />
      <Analytics />
    </div>
  )
}
