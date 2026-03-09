import { useEffect, useMemo, useState } from 'react'
import { getIdToken } from 'firebase/auth'
import { collection, collectionGroup, getDocs, limit, orderBy, query } from 'firebase/firestore'
import { auth, db } from './firebase'
import CodeEditor from './CodeEditor'
import { importExercises, normalizeExerciseImportPayload } from './exercises'
import { formatFirestoreDate } from './utils'
import ModalShell from './ModalShell'

export default function AdminDashboard({ onClose, theme }) {
  const [profiles, setProfiles] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [search, setSearch] = useState('')
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [busyAction, setBusyAction] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const loadDashboard = async () => {
    const [profileSnapshot, submissionSnapshot] = await Promise.all([
      getDocs(collection(db, 'codeDojo_users')),
      getDocs(
        query(collectionGroup(db, 'submissions'), orderBy('submittedAt', 'desc'), limit(500)),
      ),
    ])

    setProfiles(
      profileSnapshot.docs.map((documentSnapshot) => ({
        id: documentSnapshot.id,
        ...documentSnapshot.data(),
      })),
    )
    setSubmissions(
      submissionSnapshot.docs.map((documentSnapshot) => {
        const [, userId] = documentSnapshot.ref.path.split('/')
        return { id: documentSnapshot.id, userId, ...documentSnapshot.data() }
      }),
    )
  }

  useEffect(() => {
    loadDashboard().catch((err) => {
      console.error('Admin dashboard load failed:', err)
      setError(err.message || 'Failed to load dashboard data. Check Firestore indexes.')
    })
  }, [])

  const filteredProfiles = useMemo(() => {
    return [...profiles]
      .filter((profile) => {
        const haystack = `${profile.email || ''} ${profile.displayName || ''}`.toLowerCase()
        return haystack.includes(search.toLowerCase())
      })
      .sort((left, right) => {
        if ((right.totalXp || 0) !== (left.totalXp || 0)) {
          return (right.totalXp || 0) - (left.totalXp || 0)
        }
        if ((right.level || 0) !== (left.level || 0)) {
          return (right.level || 0) - (left.level || 0)
        }
        return (right.streak || 0) - (left.streak || 0)
      })
  }, [profiles, search])

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.id === selectedUserId) || null,
    [profiles, selectedUserId],
  )

  const selectedSubmissions = useMemo(
    () => submissions.filter((submission) => submission.userId === selectedUserId),
    [selectedUserId, submissions],
  )

  const summary = useMemo(() => {
    const averageScore =
      submissions.length > 0
        ? Math.round(
            submissions.reduce((sum, submission) => sum + (submission.score || 0), 0) /
              submissions.length,
          )
        : 0
    const popularityMap = submissions.reduce((map, submission) => {
      map[submission.exerciseTitle] = (map[submission.exerciseTitle] || 0) + 1
      return map
    }, {})
    const mostPopularExercise =
      Object.entries(popularityMap).sort((left, right) => right[1] - left[1])[0]?.[0] ||
      'No submissions yet'

    return {
      totalUsers: profiles.length,
      totalSubmissions: submissions.length,
      averageScore,
      mostPopularExercise,
    }
  }, [profiles.length, submissions])

  const callAdminEndpoint = async (url, userId) => {
    const token = await getIdToken(auth.currentUser)
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ userId }),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(result.error || 'Admin action failed.')
    }
  }

  const handleDeleteApiKey = async () => {
    if (!selectedProfile) return
    const confirmed = window.confirm(
      `Delete the saved API key for ${selectedProfile.displayName || selectedProfile.email || selectedProfile.id}?`,
    )
    if (!confirmed) return

    setBusyAction('delete-api-key')
    setError('')
    setMessage('')
    try {
      await callAdminEndpoint('/api/admin/delete-api-key', selectedProfile.id)
      await loadDashboard()
      setMessage('API key deleted for selected user.')
    } catch (actionError) {
      setError(actionError.message || 'Failed to delete API key.')
    } finally {
      setBusyAction('')
    }
  }

  const handleDeleteUser = async () => {
    if (!selectedProfile) return
    const targetName = selectedProfile.displayName || selectedProfile.email || selectedProfile.id
    const confirmed = window.confirm(
      `Delete user ${targetName}? This removes the Auth account, profile, submissions, leaderboard row, and saved API key.`,
    )
    if (!confirmed) return

    setBusyAction('delete-user')
    setError('')
    setMessage('')
    try {
      await callAdminEndpoint('/api/admin/delete-user', selectedProfile.id)
      setSelectedUserId(null)
      await loadDashboard()
      setMessage('User deleted successfully.')
    } catch (actionError) {
      setError(actionError.message || 'Failed to delete user.')
    } finally {
      setBusyAction('')
    }
  }

  const handleImportQuestions = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    setError('')
    setMessage('')
    setBusyAction('import-questions')
    try {
      const parsed = JSON.parse(await file.text())
      const exercises = normalizeExerciseImportPayload(parsed)
      await importExercises(exercises)
      setMessage(`Imported ${exercises.length} question${exercises.length === 1 ? '' : 's'}.`)
    } catch (importError) {
      setError(importError.message || 'Failed to import questions.')
    } finally {
      event.target.value = ''
      setBusyAction('')
    }
  }

  return (
    <ModalShell className="admin-dashboard panel" onClose={onClose}>
      <div className="section-heading">
        <div>
          <span className="eyebrow">Admin</span>
          <h2>Admin Dashboard</h2>
        </div>
        <button id="admin-dashboard-close" type="button" className="btn-ghost" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="profile-stats-grid">
        <article className="stat-card">
          <span className="eyebrow">Users</span>
          <strong>{summary.totalUsers}</strong>
        </article>
        <article className="stat-card">
          <span className="eyebrow">Submissions</span>
          <strong>{summary.totalSubmissions}</strong>
        </article>
        <article className="stat-card">
          <span className="eyebrow">Average Score</span>
          <strong>{summary.averageScore}</strong>
        </article>
        <article className="stat-card">
          <span className="eyebrow">Most Popular Exercise</span>
          <strong>{summary.mostPopularExercise}</strong>
        </article>
      </div>

      <section className="panel subtle admin-import-card">
        <div className="section-heading">
          <div>
            <h3>Question Files</h3>
            <p className="message">
              Upload a JSON file containing one exercise object or an array of exercises.
            </p>
          </div>
          <label className="btn-secondary file-button" htmlFor="admin-question-upload">
            {busyAction === 'import-questions' ? 'Uploading...' : 'Upload Question File'}
          </label>
        </div>
        <input
          id="admin-question-upload"
          type="file"
          accept=".json,application/json"
          hidden
          onChange={handleImportQuestions}
        />
        {message && <p className="message success">{message}</p>}
        {error && (
          <p className="message error" role="alert" aria-live="assertive">
            {error}
          </p>
        )}
      </section>

      <label className="field">
        <span>Search users</span>
        <input
          id="admin-user-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by email or name"
        />
      </label>

      <div className="table-shell">
        <table>
          <thead>
            <tr>
              <th scope="col">User</th>
              <th scope="col">Level</th>
              <th scope="col">XP</th>
              <th scope="col">Streak</th>
              <th scope="col">Joined</th>
            </tr>
          </thead>
          <tbody>
            {filteredProfiles.map((profile) => (
              <tr key={profile.id} onClick={() => setSelectedUserId(profile.id)}>
                <td>
                  <strong>{profile.displayName || 'Anonymous'}</strong>
                  <div>{profile.email || 'No email'}</div>
                </td>
                <td>{profile.levelName || 'White Belt'}</td>
                <td>{profile.totalXp || 0}</td>
                <td>{profile.streak || 0}</td>
                <td>{formatFirestoreDate(profile.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedUserId && (
        <section className="panel subtle">
          <div className="section-heading">
            <div>
              <h3>Selected user</h3>
              <p className="message">
                {selectedProfile?.displayName || 'Anonymous'} ·{' '}
                {selectedProfile?.email || 'No email'}
              </p>
            </div>
            <div className="inline-actions">
              <button
                id="admin-delete-api-key"
                type="button"
                className="btn-secondary"
                onClick={handleDeleteApiKey}
                disabled={busyAction === 'delete-api-key' || busyAction === 'delete-user'}
              >
                {busyAction === 'delete-api-key' ? 'Deleting Key...' : 'Delete API Key'}
              </button>
              <button
                id="admin-delete-user"
                type="button"
                className="btn-ghost danger"
                onClick={handleDeleteUser}
                disabled={busyAction === 'delete-user' || busyAction === 'delete-api-key'}
              >
                {busyAction === 'delete-user' ? 'Deleting User...' : 'Delete User'}
              </button>
              <button
                id="admin-dashboard-hide-user"
                type="button"
                className="btn-ghost"
                onClick={() => setSelectedUserId(null)}
              >
                Hide
              </button>
            </div>
          </div>

          <div className="stack-md">
            {selectedSubmissions.map((submission) => (
              <article key={submission.id} className="history-card">
                <div className="meta-row">
                  <strong>{submission.exerciseTitle}</strong>
                  <span>{submission.score}/100</span>
                  <span>+{submission.xpEarned || 0} XP</span>
                  <span>{formatFirestoreDate(submission.submittedAt)}</span>
                </div>
                <CodeEditor value={submission.code || ''} theme={theme} disabled />
                <p className="message">{submission.feedback || 'No feedback'}</p>
              </article>
            ))}
            {selectedSubmissions.length === 0 && (
              <p className="message">This user has no submissions yet.</p>
            )}
          </div>
        </section>
      )}
    </ModalShell>
  )
}
