import { useMemo, useState } from 'react'
import ExerciseList from './ExerciseList'
import ModalShell from './ModalShell'
import UserProfile from './UserProfile'
import { useTheme } from './ThemeContext'

const QA_EXERCISES = [
  {
    id: 'sum-pairs',
    title: 'Sum Pair Indexes',
    difficulty: 'easy',
    category: 'algorithms',
    topics: ['arrays', 'maps'],
    description: 'Return the indexes of two numbers that sum to a target.',
    starterCode: 'export function sumPairs(nums, target) {\n  return []\n}',
    testCases: [{ input: '[2, 7, 11, 15], 9', expected: '[0, 1]' }],
    hint: 'Use a map to track complements.',
    solutionApproach: 'Store seen numbers in a map keyed by value.',
    baseXp: 120,
    estimatedMinutes: 12,
    attemptCount: 10,
    solvedCount: 7,
  },
  {
    id: 'group-status',
    title: 'Group Todos by Status',
    difficulty: 'medium',
    category: 'patterns',
    topics: ['array', 'reduce'],
    description: 'Group todo items by status using a reducer.',
    starterCode: 'export function groupByStatus(todos) {\n  return {}\n}',
    testCases: [{ input: "[{ status: 'done' }]", expected: '{ done: [...] }' }],
    hint: 'Initialize each bucket lazily.',
    solutionApproach: 'Reduce into an object keyed by status.',
    baseXp: 180,
    estimatedMinutes: 18,
    attemptCount: 9,
    solvedCount: 3,
  },
  {
    id: 'memo-fib',
    title: 'Memoized Fibonacci',
    difficulty: 'hard',
    category: 'algorithms',
    topics: ['recursion', 'memoization'],
    description: 'Return the nth Fibonacci number with memoization.',
    starterCode: 'export function fib(n, memo = {}) {\n  return 0\n}',
    testCases: [{ input: '10', expected: '55' }],
    hint: 'Cache intermediate results by n.',
    solutionApproach: 'Use a memo object to avoid repeated work.',
    baseXp: 240,
    estimatedMinutes: 22,
    attemptCount: 4,
    solvedCount: 1,
  },
]

const QA_PROFILE = {
  displayName: 'QA Sensei',
  totalXp: 1840,
  levelName: 'Blue Belt',
  streak: 6,
  bookmarks: ['sum-pairs', 'memo-fib'],
}

const QA_SUBMISSIONS = [
  {
    exerciseId: 'sum-pairs',
    exerciseTitle: 'Sum Pair Indexes',
    score: 92,
    xpEarned: 120,
    submittedAt: new Date().toISOString(),
  },
  {
    exerciseId: 'group-status',
    exerciseTitle: 'Group Todos by Status',
    score: 58,
    xpEarned: 81,
    submittedAt: new Date(Date.now() - 86400000).toISOString(),
  },
]

function QaSettingsModal({ onClose }) {
  const { theme, setTheme } = useTheme()
  const tooltipProps = (label) => ({ title: label, 'data-tooltip': label })

  return (
    <ModalShell className="settings-panel panel" size="md" onClose={onClose}>
      <div className="modal-header">
        <div className="modal-heading">
          <span className="eyebrow">Settings</span>
          <h2>Appearance Review</h2>
        </div>
        <button type="button" className="btn-ghost modal-close-button" onClick={onClose}>
          Close
        </button>
      </div>

      <section className="panel subtle settings-card modal-section">
        <h3>Theme</h3>
        <p className="message">Switch themes with the modal open to inspect the transition.</p>
        <div className="theme-choice-row" role="radiogroup" aria-label="QA theme selection">
          <button
            id="qa-theme-light"
            type="button"
            className={`theme-choice ${theme === 'light' ? 'active' : ''}`}
            onClick={() => setTheme('light')}
          >
            <strong>Light</strong>
            <span>Soft paper workspace</span>
          </button>
          <button
            id="qa-theme-dark"
            type="button"
            className={`theme-choice ${theme === 'dark' ? 'active' : ''}`}
            onClick={() => setTheme('dark')}
          >
            <strong>Dark</strong>
            <span>Night dojo workspace</span>
          </button>
        </div>
      </section>

      <section className="panel subtle settings-card modal-section">
        <div className="modal-subheader">
          <div className="modal-heading">
            <h3>Icon Hover Audit</h3>
            <p className="message">Hover each control to verify the shared icon behavior.</p>
          </div>
          <div className="topbar-controls">
            <button
              type="button"
              className="icon-button"
              aria-label="Settings icon sample"
              {...tooltipProps('Your settings')}
            >
              ⚙
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label="Profile icon sample"
              {...tooltipProps('Your profile')}
            >
              👤
            </button>
            <button
              type="button"
              className="bookmark-button active"
              aria-label="Bookmark sample"
              {...tooltipProps('Remove bookmark')}
            >
              ♥
            </button>
          </div>
        </div>
      </section>
    </ModalShell>
  )
}

function QaDenseModal({ onClose }) {
  return (
    <ModalShell className="admin-dashboard panel" size="lg" onClose={onClose}>
      <div className="modal-header">
        <div className="modal-heading">
          <span className="eyebrow">Dense modal</span>
          <h2>Admin-style content review</h2>
        </div>
        <button type="button" className="btn-ghost modal-close-button" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="modal-section profile-stats-grid">
        {['Users', 'Submissions', 'Average Score', 'Most Popular Exercise'].map((label, index) => (
          <article key={label} className="stat-card">
            <span className="eyebrow">{label}</span>
            <strong>{index === 3 ? 'Sum Pair Indexes' : 12 + index * 8}</strong>
          </article>
        ))}
      </div>

      <div className="modal-section table-shell">
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Level</th>
              <th>XP</th>
              <th>Streak</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 8 }, (_, index) => (
              <tr key={index}>
                <td>Player {index + 1}</td>
                <td>Blue Belt</td>
                <td>{1500 - index * 70}</td>
                <td>{7 - Math.min(index, 6)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ModalShell>
  )
}

export default function ModalQaHarness() {
  const { theme, setTheme } = useTheme()
  const [openModal, setOpenModal] = useState('')
  const [filters, setFilters] = useState({
    search: '',
    difficulty: 'all',
    topic: 'all',
    category: 'all',
    status: 'all',
    bookmarkedOnly: false,
  })
  const [bookmarks, setBookmarks] = useState(['memo-fib'])
  const tooltipProps = (label) => ({ title: label, 'data-tooltip': label })

  const filteredExercises = useMemo(() => {
    return QA_EXERCISES.filter((exercise) => {
      const matchesSearch = exercise.title.toLowerCase().includes(filters.search.toLowerCase())
      const matchesDifficulty =
        filters.difficulty === 'all' || exercise.difficulty === filters.difficulty
      const matchesTopic = filters.topic === 'all' || exercise.topics.includes(filters.topic)
      const matchesCategory = filters.category === 'all' || exercise.category === filters.category
      const matchesBookmark = !filters.bookmarkedOnly || bookmarks.includes(exercise.id)
      return (
        matchesSearch && matchesDifficulty && matchesTopic && matchesCategory && matchesBookmark
      )
    })
  }, [bookmarks, filters])

  return (
    <div className="app-shell" data-testid="qa-harness">
      <header className="topbar panel">
        <div className="topbar-brand">
          <div className="brand-mark" aria-hidden="true">
            🏯
          </div>
          <div className="brand-copy">
            <span className="eyebrow">QA harness</span>
            <strong>Modal Review</strong>
          </div>
        </div>
        <div className="topbar-progress">
          <div className="level-badge" style={{ '--belt-color': '#679bd1' }}>
            <span>QA</span>
          </div>
          <div className="progress-cluster">
            <div className="progress-copy">
              <span>Theme and modal verification</span>
              <span>{theme} mode</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: '72%' }} />
            </div>
          </div>
          <div className="today-xp">Live UI review</div>
        </div>
        <div className="topbar-actions">
          <div className="topbar-controls">
            <button
              id="qa-topbar-theme"
              type="button"
              className="icon-button"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label="Toggle theme from harness"
              {...tooltipProps('Toggle theme')}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label="Settings sample"
              {...tooltipProps('Your settings')}
            >
              ⚙
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label="Leaderboard sample"
              {...tooltipProps('Leaderboard')}
            >
              🏆
            </button>
          </div>
        </div>
      </header>

      <main className="panel exercise-detail stack-md">
        <div className="modal-heading">
          <span className="eyebrow">Harness controls</span>
          <h2>Open each modal and inspect spacing, hover, and theme transitions.</h2>
        </div>
        <div className="inline-actions">
          <button
            id="qa-open-exercise-browser"
            type="button"
            className="btn-primary"
            onClick={() => setOpenModal('browser')}
          >
            Exercise Browser
          </button>
          <button
            id="qa-open-settings"
            type="button"
            className="btn-secondary"
            onClick={() => setOpenModal('settings')}
          >
            Settings
          </button>
          <button
            id="qa-open-profile"
            type="button"
            className="btn-ghost"
            onClick={() => setOpenModal('profile')}
          >
            Profile
          </button>
          <button
            id="qa-open-dense"
            type="button"
            className="btn-ghost"
            onClick={() => setOpenModal('dense')}
          >
            Dense Modal
          </button>
        </div>
      </main>

      {openModal === 'browser' && (
        <ExerciseList
          exercises={filteredExercises}
          currentExerciseId={filteredExercises[0]?.id || ''}
          statusMap={{ 'sum-pairs': 'solved', 'group-status': 'attempted' }}
          bookmarks={bookmarks}
          filters={{
            ...filters,
            availableTopics: ['array', 'arrays', 'maps', 'reduce', 'recursion', 'memoization'],
            availableCategories: ['algorithms', 'patterns'],
          }}
          onFilterChange={(field, value) =>
            setFilters((current) => ({ ...current, [field]: value }))
          }
          onSelectExercise={() => setOpenModal('')}
          onToggleBookmark={(exerciseId) =>
            setBookmarks((current) =>
              current.includes(exerciseId)
                ? current.filter((bookmarkId) => bookmarkId !== exerciseId)
                : [...current, exerciseId],
            )
          }
          onClose={() => setOpenModal('')}
        />
      )}

      {openModal === 'settings' && <QaSettingsModal onClose={() => setOpenModal('')} />}

      {openModal === 'profile' && (
        <UserProfile
          profile={QA_PROFILE}
          submissions={QA_SUBMISSIONS}
          bookmarkedExercises={QA_EXERCISES.filter((exercise) =>
            QA_PROFILE.bookmarks.includes(exercise.id),
          )}
          onClose={() => setOpenModal('')}
        />
      )}

      {openModal === 'dense' && <QaDenseModal onClose={() => setOpenModal('')} />}
    </div>
  )
}
