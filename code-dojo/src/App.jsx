import { Analytics } from '@vercel/analytics/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { LogOut } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { getIdToken } from 'firebase/auth'
import { addDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore'
import { useAuth } from './AuthContext'
import { useTheme } from './ThemeContext'
import { auth, db } from './firebase'
import { fetchExercises } from './exercises'
import { getLevelMeta } from './levels'
import AuthModal from './AuthModal'
import ApiKeySetup from './ApiKeySetup'
import CodeEditor from './CodeEditor'
import Timer from './Timer'
import ExerciseList from './ExerciseList'
import ExerciseManager from './ExerciseManager'
import AdminDashboard from './AdminDashboard'
import Leaderboard from './Leaderboard'
import UserProfile from './UserProfile'
import SettingsPanel from './SettingsPanel'
import RankHoverCard from './RankHoverCard'
import GuidedSolutionModal from './GuidedSolutionModal'

function SplashScreen({ message }) {
  return (
    <div className="screen-center">
      <section className="panel loading-panel">
        <span className="eyebrow">Code Dojo</span>
        <h1>{message}</h1>
      </section>
    </div>
  )
}

function scoreClass(score) {
  if (score >= 80) return 'excellent'
  if (score >= 50) return 'warning'
  return 'danger'
}

function submissionTime(value) {
  if (!value) return 0
  if (typeof value.toDate === 'function') return value.toDate().getTime()
  return new Date(value).getTime()
}

function getSubmissionErrorMessage(error) {
  const message = error?.message || ''

  if (message.includes('Must be logged in')) {
    return 'Your session expired. Sign in again and retry the submission.'
  }

  if (message.includes('backend is not reachable') || message.includes('internal')) {
    return 'The evaluation backend is not reachable yet. Check the Vercel API deployment.'
  }

  if (message.includes('invalid')) {
    return 'Your Gemini API key was rejected. Update it in Settings and try again.'
  }

  if (message.includes('Daily limit reached')) {
    return 'Daily submission limit reached. Try again tomorrow.'
  }

  if (message.includes('No API key saved')) {
    return 'No API key is saved for this account. Open Settings and save one first.'
  }

  return message || 'Submission failed.'
}

function getGuidedSolutionErrorMessage(error) {
  const message = error?.message || ''

  if (message.includes('Must be logged in')) {
    return 'Your session expired. Sign in again and try again.'
  }

  if (message.includes('No API key saved')) {
    return 'No API key is saved for this account. Open Settings and save one first.'
  }

  if (message.includes('invalid')) {
    return 'Your Gemini API key was rejected. Update it in Settings and try again.'
  }

  if (message.includes('Daily guided solution limit reached')) {
    return 'Daily guided solution limit reached. Try again tomorrow.'
  }

  return message || 'Guided solution request failed.'
}

export default function App() {
  const {
    user,
    profile,
    loading,
    profileLoading,
    isAdmin,
    logout,
    refreshProfile,
    updateUserProfile,
  } = useAuth()
  const { theme, setTheme, toggleTheme } = useTheme()

  const [exercises, setExercises] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [selectedExerciseId, setSelectedExerciseId] = useState('')
  const [filters, setFilters] = useState({
    search: '',
    difficulty: 'all',
    topic: 'all',
    category: 'all',
    status: 'all',
    bookmarkedOnly: false,
  })
  const [code, setCode] = useState('')
  const [showHint, setShowHint] = useState(false)
  const [hintUsed, setHintUsed] = useState(false)
  const [showSolution, setShowSolution] = useState(false)
  const [score, setScore] = useState(null)
  const [feedback, setFeedback] = useState('')
  const [earnedXp, setEarnedXp] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [guidedSolution, setGuidedSolution] = useState(null)
  const [guidedSolutionUsed, setGuidedSolutionUsed] = useState(false)
  const [showGuidedSolutionModal, setShowGuidedSolutionModal] = useState(false)
  const [loadingGuidedSolution, setLoadingGuidedSolution] = useState(false)
  const [timerRunning, setTimerRunning] = useState(false)
  const [timerResetKey, setTimerResetKey] = useState(0)
  const [attemptStartedAt, setAttemptStartedAt] = useState(null)
  const [loadingExercises, setLoadingExercises] = useState(true)
  const [showSettingsPanel, setShowSettingsPanel] = useState(false)
  const [showExerciseManager, setShowExerciseManager] = useState(false)
  const [showAdminDashboard, setShowAdminDashboard] = useState(false)
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [showExerciseBrowser, setShowExerciseBrowser] = useState(false)
  const editorRef = useRef(null)

  const availableTopics = useMemo(
    () => [...new Set(exercises.flatMap((exercise) => exercise.topics || []))].sort(),
    [exercises],
  )
  const availableCategories = useMemo(
    () => [...new Set(exercises.map((exercise) => exercise.category).filter(Boolean))].sort(),
    [exercises],
  )

  const statusMap = useMemo(
    () =>
      submissions.reduce((map, submission) => {
        const nextStatus = submission.score >= 60 ? 'solved' : 'attempted'
        if (map[submission.exerciseId] !== 'solved') {
          map[submission.exerciseId] = nextStatus
        }
        return map
      }, {}),
    [submissions],
  )

  const visibleExercises = useMemo(() => {
    const bookmarks = profile?.bookmarks || []
    return exercises.filter((exercise) => {
      const titleMatch = exercise.title.toLowerCase().includes(filters.search.toLowerCase())
      const difficultyMatch =
        filters.difficulty === 'all' || exercise.difficulty === filters.difficulty
      const topicMatch = filters.topic === 'all' || exercise.topics?.includes(filters.topic)
      const categoryMatch = filters.category === 'all' || exercise.category === filters.category
      const statusMatch =
        filters.status === 'all' || (statusMap[exercise.id] || 'unsolved') === filters.status
      const bookmarkMatch = !filters.bookmarkedOnly || bookmarks.includes(exercise.id)
      return (
        titleMatch && difficultyMatch && topicMatch && categoryMatch && statusMatch && bookmarkMatch
      )
    })
  }, [exercises, filters, profile?.bookmarks, statusMap])

  const currentExercise = useMemo(
    () =>
      visibleExercises.find((exercise) => exercise.id === selectedExerciseId) ||
      visibleExercises[0] ||
      null,
    [selectedExerciseId, visibleExercises],
  )

  const sortedSubmissions = useMemo(
    () =>
      [...submissions].sort(
        (left, right) => submissionTime(right.submittedAt) - submissionTime(left.submittedAt),
      ),
    [submissions],
  )

  const levelMeta = getLevelMeta(profile?.totalXp || 0)
  const bookmarks = profile?.bookmarks || []
  const bookmarkedExercises = exercises.filter((exercise) => bookmarks.includes(exercise.id))
  const nextLevelXp = levelMeta.next ? levelMeta.next.xpRequired : profile?.totalXp || 0
  const currentLevelXp = levelMeta.current?.xpRequired || 0
  const xpIntoLevel = Math.max(0, (profile?.totalXp || 0) - currentLevelXp)
  const xpNeededForLevel = Math.max(1, nextLevelXp - currentLevelXp)
  const exampleCase = currentExercise?.testCases?.[0] || null
  const currentStatus = currentExercise ? statusMap[currentExercise.id] || 'unsolved' : 'unsolved'
  const tooltipProps = (label) => ({ title: label, 'data-tooltip': label })

  const refreshExercises = async () => {
    setLoadingExercises(true)
    const nextExercises = await fetchExercises()
    setExercises(nextExercises)
    setLoadingExercises(false)
  }

  const refreshSubmissions = async () => {
    if (!user) return
    const snapshot = await getDocs(collection(db, 'codeDojo_users', user.uid, 'submissions'))
    setSubmissions(
      snapshot.docs.map((documentSnapshot) => ({
        id: documentSnapshot.id,
        ...documentSnapshot.data(),
      })),
    )
  }

  useEffect(() => {
    refreshExercises().catch(() => setLoadingExercises(false))
  }, [])

  useEffect(() => {
    if (!user) {
      setSubmissions([])
      return
    }
    refreshSubmissions().catch(() => setSubmissions([]))
  }, [user])

  useEffect(() => {
    if (profile?.theme && profile.theme !== theme) {
      setTheme(profile.theme)
    }
  }, [profile?.theme, setTheme, theme])

  useEffect(() => {
    if (!currentExercise) {
      setSelectedExerciseId('')
      setCode('')
      return
    }

    setSelectedExerciseId(currentExercise.id)
    setCode(currentExercise.starterCode || '')
    setShowHint(false)
    setHintUsed(false)
    setShowSolution(false)
    setGuidedSolution(null)
    setGuidedSolutionUsed(false)
    setShowGuidedSolutionModal(false)
    setScore(null)
    setFeedback('')
    setEarnedXp(null)
    setTimerRunning(false)
    setAttemptStartedAt(null)
    setTimerResetKey((currentKey) => currentKey + 1)
  }, [currentExercise?.id])

  const updateFilter = (field, value) => {
    setFilters((currentFilters) => ({ ...currentFilters, [field]: value }))
  }

  const toggleBookmark = async (exerciseId) => {
    const nextBookmarks = bookmarks.includes(exerciseId)
      ? bookmarks.filter((bookmarkId) => bookmarkId !== exerciseId)
      : [...bookmarks, exerciseId]
    await updateUserProfile({ bookmarks: nextBookmarks })
  }

  const handleStartTimer = () => {
    setTimerRunning(true)
    setAttemptStartedAt(Date.now())
  }

  const handleSubmit = async () => {
    if (!currentExercise || !user) return

    setSubmitting(true)
    try {
      const token = await getIdToken(auth.currentUser)
      const response = await fetch('/api/evaluate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          exerciseId: currentExercise.id,
          exerciseTitle: currentExercise.title,
          exerciseDescription: currentExercise.description,
          testCases: currentExercise.testCases || [],
          code,
          hintUsed,
          guidedSolutionUsed,
          baseXp: currentExercise.baseXp,
          timeSpent: attemptStartedAt ? Math.round((Date.now() - attemptStartedAt) / 1000) : null,
        }),
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Evaluation failed')
      }

      setScore(result.score)
      setFeedback(result.feedback)
      setEarnedXp(result.xpEarned)
      setShowSolution(result.score < 50)
      setTimerRunning(false)

      await Promise.all([refreshSubmissions(), refreshProfile(), refreshExercises()])
    } catch (submitError) {
      setScore(0)
      setFeedback(getSubmissionErrorMessage(submitError))
      setEarnedXp(0)
      setShowSolution(true)
    } finally {
      setSubmitting(false)
    }
  }

  const handleGiveUp = async () => {
    if (!currentExercise || !user) return

    await addDoc(collection(db, 'codeDojo_users', user.uid, 'submissions'), {
      exerciseId: currentExercise.id,
      exerciseTitle: currentExercise.title,
      code,
      score: 0,
      feedback: 'You gave up on this exercise. Review the solution approach and try again.',
      xpEarned: 0,
      hintUsed,
      guidedSolutionUsed,
      timeSpent: attemptStartedAt ? Math.round((Date.now() - attemptStartedAt) / 1000) : null,
      submittedAt: serverTimestamp(),
    })

    setScore(0)
    setFeedback('You gave up on this exercise. Review the solution approach and try again.')
    setEarnedXp(0)
    setShowSolution(true)
    setTimerRunning(false)
    await refreshSubmissions()
  }

  const handleConfirmGuidedSolution = async () => {
    if (!currentExercise || !user) return

    setLoadingGuidedSolution(true)
    try {
      const token = await getIdToken(auth.currentUser)
      const response = await fetch('/api/guided-solution', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          exerciseId: currentExercise.id,
          exerciseTitle: currentExercise.title,
          exerciseDescription: currentExercise.description,
          starterCode: currentExercise.starterCode || '',
          testCases: currentExercise.testCases || [],
          hint: currentExercise.hint || '',
          solutionApproach: currentExercise.solutionApproach || '',
          code,
        }),
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Guided solution failed')
      }

      setGuidedSolution(result)
      setGuidedSolutionUsed(true)
      setHintUsed(true)
      setFeedback(
        'Guided solution revealed. You can still submit for feedback, but XP for this exercise attempt is now locked to 0.',
      )
      setEarnedXp(0)
      await refreshExercises()
    } catch (guidedSolutionError) {
      setGuidedSolution(null)
      setFeedback(getGuidedSolutionErrorMessage(guidedSolutionError))
      setEarnedXp(0)
    } finally {
      setLoadingGuidedSolution(false)
    }
  }

  const handleThemeChange = async (nextTheme) => {
    if (nextTheme === theme) return
    setTheme(nextTheme)
    localStorage.setItem('codeDojo_theme', nextTheme)
    await updateUserProfile({ theme: nextTheme })
  }

  const focusEditor = () => {
    requestAnimationFrame(() => {
      editorRef.current?.focus?.()
    })
  }

  if (loading || profileLoading) return <SplashScreen message="Loading your dojo..." />
  if (!user) return <AuthModal />
  if (!profile?.hasApiKey) {
    return (
      <div className="screen-center">
        <ApiKeySetup />
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="topbar panel">
        <div className="topbar-brand">
          <div className="brand-mark" aria-hidden="true">
            🏯
          </div>
          <div className="brand-copy">
            <span className="eyebrow">Code Dojo</span>
            <strong>Code Dojo</strong>
          </div>
        </div>

        <div className="topbar-progress">
          <RankHoverCard
            totalXp={profile?.totalXp || 0}
            triggerClassName="level-badge"
            triggerStyle={{ '--belt-color': levelMeta.current.color }}
            triggerLabel={`Current rank: ${levelMeta.current.name}`}
            triggerContent={<span>Lv {levelMeta.levelIndex + 1}</span>}
          />
          <div className="progress-cluster">
            <div className="progress-copy">
              <span>
                {xpIntoLevel.toLocaleString()} / {xpNeededForLevel.toLocaleString()} XP
              </span>
              <span>
                {levelMeta.next
                  ? `${nextLevelXp - (profile?.totalXp || 0)} XP to next belt`
                  : 'Max rank reached'}
              </span>
            </div>
            <div className="progress-track hud-progress">
              <div className="progress-fill shimmer" style={{ width: `${levelMeta.progress}%` }} />
            </div>
          </div>
          <div className="today-xp">+{profile?.xpToday || 0} XP Today</div>
        </div>

        <div className="topbar-actions">
          <div className="user-chip">
            <div className="user-avatar" aria-hidden="true">
              {profile?.displayName?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'C'}
            </div>
            <div>
              <strong>{profile?.displayName || user.email?.split('@')[0] || 'Code Ninja'}</strong>
              <span className="streak-badge">🔥 {profile?.streak || 0} daily streak</span>
            </div>
          </div>

          <div className="topbar-controls">
            <button
              id="theme-toggle"
              type="button"
              className="icon-button"
              onClick={() => handleThemeChange(theme === 'dark' ? 'light' : 'dark')}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              {...tooltipProps(`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`)}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button
              id="open-settings"
              type="button"
              className="icon-button"
              onClick={() => setShowSettingsPanel(true)}
              aria-label="Open settings"
              {...tooltipProps('Your settings')}
            >
              ⚙
            </button>
            <button
              id="open-profile"
              type="button"
              className="icon-button"
              onClick={() => setShowProfile(true)}
              aria-label="Open profile"
              {...tooltipProps('Your profile')}
            >
              👤
            </button>
            <button
              id="open-leaderboard"
              type="button"
              className="icon-button"
              onClick={() => setShowLeaderboard(true)}
              aria-label="Open leaderboard"
              {...tooltipProps('Leaderboard')}
            >
              🏆
            </button>
            {isAdmin && (
              <button
                id="open-admin-dashboard"
                type="button"
                className="admin-pill"
                onClick={() => setShowAdminDashboard(true)}
              >
                Admin
              </button>
            )}
            <button
              id="logout-button"
              type="button"
              className="icon-button"
              onClick={logout}
              aria-label="Log out"
              {...tooltipProps('Log out')}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="workspace-shell">
        <aside className="sidebar-rail panel" aria-label="Workspace navigation">
          <button
            type="button"
            className="rail-button active"
            aria-label="Home"
            {...tooltipProps('Home')}
          >
            🏠
          </button>
          <button
            type="button"
            className="rail-button"
            aria-label="Exercise browser"
            onClick={() => setShowExerciseBrowser(true)}
            {...tooltipProps('Exercise browser')}
          >
            📋
          </button>
          <button
            type="button"
            className="rail-button"
            aria-label="Leaderboard"
            onClick={() => setShowLeaderboard(true)}
            {...tooltipProps('Leaderboard')}
          >
            🏆
          </button>
          <button
            type="button"
            className="rail-button"
            aria-label="Profile"
            onClick={() => setShowProfile(true)}
            {...tooltipProps('Your profile')}
          >
            👤
          </button>
          <button
            type="button"
            className="rail-button"
            aria-label="API settings"
            onClick={() => setShowSettingsPanel(true)}
            {...tooltipProps('Your settings')}
          >
            ⚙
          </button>
          {isAdmin && (
            <button
              type="button"
              className="rail-button"
              aria-label="Exercise manager"
              onClick={() => setShowExerciseManager(true)}
              {...tooltipProps('Exercise manager')}
            >
              👑
            </button>
          )}
        </aside>

        <div className="split-layout">
          <section className="panel exercise-detail surface-card">
            {loadingExercises ? (
              <p className="message">Loading exercises...</p>
            ) : currentExercise ? (
              <>
                <div className="detail-block detail-title">
                  <div className="detail-label-row">
                    <span className="detail-icon" aria-hidden="true">
                      📋
                    </span>
                    <span className="eyebrow">Title:</span>
                  </div>
                  <span className={`difficulty-pill ${currentExercise.difficulty}`}>
                    {currentExercise.difficulty}
                  </span>
                </div>
                <h2 className="exercise-title">{currentExercise.title}</h2>
                <div className="detail-divider" />

                <div className="detail-block">
                  <div className="detail-label-row">
                    <span className="detail-icon" aria-hidden="true">
                      ☆
                    </span>
                    <span className="eyebrow">Points:</span>
                  </div>
                  <p className="points-value">{currentExercise.baseXp} XP</p>
                </div>

                <div className="detail-block">
                  <div className="detail-label-row">
                    <span className="detail-icon" aria-hidden="true">
                      ◇
                    </span>
                    <span className="eyebrow">Topic Tags:</span>
                  </div>
                  <div className="tag-row">
                    {currentExercise.topics.map((topic) => (
                      <span key={topic} className="tag">
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="detail-block">
                  <div className="detail-label-row">
                    <span className="detail-icon" aria-hidden="true">
                      ◎
                    </span>
                    <span className="eyebrow">Objective:</span>
                  </div>
                  <p className="detail-copy">{currentExercise.description}</p>
                </div>

                {exampleCase && (
                  <div className="detail-block">
                    <div className="detail-label-row">
                      <span className="detail-icon" aria-hidden="true">
                        ⌘
                      </span>
                      <span className="eyebrow">Examples:</span>
                    </div>
                    <pre className="example-block">
                      <code>
                        Input: {exampleCase.input}
                        {'\n'}
                        Output: {exampleCase.expected}
                      </code>
                    </pre>
                  </div>
                )}

                <div className="detail-block">
                  <div className="detail-label-row">
                    <span className="detail-icon" aria-hidden="true">
                      ◌
                    </span>
                    <span className="eyebrow">Constraints:</span>
                  </div>
                  <ul className="constraint-list">
                    <li>Estimated time: {currentExercise.estimatedMinutes} minutes</li>
                    <li>Status: {currentStatus}</li>
                    <li>Category: {currentExercise.category}</li>
                  </ul>
                </div>

                <Timer
                  minutes={currentExercise.estimatedMinutes}
                  running={timerRunning}
                  onStart={handleStartTimer}
                  onExpire={() => setFeedback('Timer expired. You can still submit your work.')}
                  resetKey={timerResetKey}
                />

                <div className="detail-footer">
                  <button
                    id="toggle-hint"
                    type="button"
                    className="btn-ghost"
                    onClick={() => {
                      setShowHint((currentValue) => !currentValue)
                      setHintUsed(true)
                    }}
                  >
                    💡 {showHint ? 'Hide Hint' : 'Use Hint (-35% XP)'}
                  </button>
                  <button
                    id="show-guided-solution"
                    type="button"
                    className="btn-ghost"
                    onClick={() => setShowGuidedSolutionModal(true)}
                  >
                    📘 Show Guided Solution
                  </button>
                  <button
                    id={`bookmark-selected-${currentExercise.id}`}
                    type="button"
                    className={`bookmark-button detail-bookmark ${bookmarks.includes(currentExercise.id) ? 'active' : ''}`}
                    onClick={() => toggleBookmark(currentExercise.id)}
                    aria-label={
                      bookmarks.includes(currentExercise.id)
                        ? 'Remove bookmark'
                        : 'Bookmark exercise'
                    }
                    {...tooltipProps(
                      bookmarks.includes(currentExercise.id)
                        ? 'Remove bookmark'
                        : 'Bookmark exercise',
                    )}
                  >
                    {bookmarks.includes(currentExercise.id) ? '♥' : '♡'}
                  </button>
                  <button
                    id="give-up"
                    type="button"
                    className="btn-ghost danger"
                    onClick={handleGiveUp}
                  >
                    Give Up
                  </button>
                </div>

                {showHint && <div className="hint-box">💡 {currentExercise.hint}</div>}
                {guidedSolutionUsed && (
                  <div className="hint-box warning">
                    Guided solution used. XP for this exercise attempt is locked to 0.
                  </div>
                )}
                {showSolution && (
                  <div className="solution-box">
                    <h3>Solution Approach</h3>
                    <p>{currentExercise.solutionApproach}</p>
                  </div>
                )}
              </>
            ) : (
              <p className="message">No exercises match the current filters.</p>
            )}
          </section>

          <div className="workspace-main-panels">
            <section className="editor-panel panel surface-card">
              <div className="editor-header">
                <div>
                  <span className="eyebrow">Code Editor</span>
                  <h2>
                    {currentExercise ? `${currentExercise.title} Challenge` : 'Select an exercise'}
                  </h2>
                </div>
                <div className="controls">
                  <button type="button" className="btn-primary muted" disabled>
                    ▶ Run Code
                  </button>
                  <button
                    id="submit-solution"
                    type="button"
                    className="btn-secondary accent"
                    onClick={handleSubmit}
                    disabled={submitting || !currentExercise}
                  >
                    {submitting ? 'Submitting...' : 'Submit'}
                  </button>
                  <button
                    id="next-exercise"
                    type="button"
                    className="btn-ghost"
                    onClick={() => {
                      const currentIndex = visibleExercises.findIndex(
                        (exercise) => exercise.id === currentExercise?.id,
                      )
                      const nextExercise = visibleExercises[currentIndex + 1] || visibleExercises[0]
                      setSelectedExerciseId(nextExercise?.id || '')
                    }}
                    disabled={!currentExercise || visibleExercises.length === 0}
                  >
                    Next
                  </button>
                </div>
              </div>

              <div className="editor-surface">
                <div className="editor-toolbar">
                  <div className="window-dots" aria-hidden="true">
                    <span className="dot red" />
                    <span className="dot yellow" />
                    <span className="dot green" />
                  </div>
                  <button
                    type="button"
                    className="icon-button copy-button"
                    onClick={() => navigator.clipboard?.writeText(code)}
                    aria-label="Copy code"
                    {...tooltipProps('Copy code')}
                  >
                    ⧉
                  </button>
                </div>

                <CodeEditor
                  ref={editorRef}
                  value={code}
                  onChange={setCode}
                  disabled={!currentExercise}
                  theme={theme}
                />
              </div>
            </section>

            <section className="review-panel panel surface-card">
              <div className="editor-header review-header">
                <div>
                  <span className="eyebrow">Code Review</span>
                  <h2>{score !== null ? 'Feedback and score' : 'Review will appear here'}</h2>
                </div>
              </div>

              <section className="console-panel review-surface">
                {score !== null ? (
                  <section className="feedback-card">
                    <div className="feedback-header">
                      <div
                        className={`score-ring ${scoreClass(score)}`}
                        style={{ '--score-value': `${score}%` }}
                      >
                        <strong>{score}</strong>
                        <span>Score</span>
                      </div>
                      <div>
                        <h3>Results</h3>
                        <p className="xp-earned">
                          +{earnedXp || 0} XP {profile?.streak >= 7 ? '• streak bonus active' : ''}
                        </p>
                        {guidedSolutionUsed && (
                          <p className="message warning">
                            Guided solution used: feedback only, no XP awarded.
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="feedback-body markdown-body">
                      <ReactMarkdown>{feedback}</ReactMarkdown>
                    </div>
                  </section>
                ) : (
                  <>
                    <div className="console-label">&gt;_ Recent reviews</div>
                    <div className="console-history">
                      {sortedSubmissions.slice(0, 3).map((submission) => (
                        <article key={submission.id} className="history-card compact">
                          <div className="meta-row">
                            <strong>{submission.exerciseTitle}</strong>
                            <span>{submission.score}/100</span>
                            <span>+{submission.xpEarned || 0} XP</span>
                          </div>
                        </article>
                      ))}
                      {sortedSubmissions.length === 0 && (
                        <p className="message">
                          Submit your solution to see the code review, score, and XP feedback here.
                        </p>
                      )}
                    </div>
                  </>
                )}
              </section>
            </section>
          </div>
        </div>
      </main>

      {showExerciseBrowser && (
        <ExerciseList
          exercises={visibleExercises}
          currentExerciseId={currentExercise?.id || ''}
          statusMap={statusMap}
          bookmarks={bookmarks}
          filters={{ ...filters, availableTopics, availableCategories }}
          onFilterChange={updateFilter}
          onSelectExercise={(exerciseId) => {
            setSelectedExerciseId(exerciseId)
            setShowExerciseBrowser(false)
          }}
          onToggleBookmark={toggleBookmark}
          onClose={() => setShowExerciseBrowser(false)}
        />
      )}

      {showSettingsPanel && (
        <SettingsPanel
          profile={profile}
          theme={theme}
          onSaveTheme={handleThemeChange}
          onSaveDisplayName={async (displayName) => {
            await updateUserProfile({
              displayName: displayName.trim() || profile?.displayName || 'Anonymous',
            })
          }}
          onClose={() => setShowSettingsPanel(false)}
        />
      )}

      {showExerciseManager && (
        <ExerciseManager
          exercises={exercises}
          onClose={() => setShowExerciseManager(false)}
          onRefresh={refreshExercises}
        />
      )}
      {showAdminDashboard && (
        <AdminDashboard
          onClose={() => setShowAdminDashboard(false)}
          theme={theme}
          onRefresh={refreshExercises}
        />
      )}
      {showLeaderboard && (
        <Leaderboard currentUserId={user.uid} onClose={() => setShowLeaderboard(false)} />
      )}
      {showProfile && (
        <UserProfile
          profile={profile}
          submissions={sortedSubmissions}
          bookmarkedExercises={bookmarkedExercises}
          onClose={() => setShowProfile(false)}
        />
      )}
      {showGuidedSolutionModal && (
        <GuidedSolutionModal
          loading={loadingGuidedSolution}
          currentExercise={currentExercise}
          guidedSolution={guidedSolution}
          onConfirm={handleConfirmGuidedSolution}
          onApply={() => {
            if (guidedSolution?.solutionCode) {
              setCode(guidedSolution.solutionCode)
              setShowGuidedSolutionModal(false)
              focusEditor()
            }
          }}
          onClose={() => setShowGuidedSolutionModal(false)}
        />
      )}
      <Analytics />
    </div>
  )
}
