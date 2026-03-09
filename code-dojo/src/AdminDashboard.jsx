import { useEffect, useMemo, useState } from 'react'
import { collection, collectionGroup, getDocs, orderBy, query } from 'firebase/firestore'
import { db } from './firebase'
import CodeEditor from './CodeEditor'

function formatDate(value) {
  if (!value) return 'Pending'
  if (typeof value.toDate === 'function') return value.toDate().toLocaleString()
  return new Date(value).toLocaleString()
}

export default function AdminDashboard({ onClose, theme }) {
  const [profiles, setProfiles] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [search, setSearch] = useState('')
  const [selectedUserId, setSelectedUserId] = useState(null)

  useEffect(() => {
    const loadDashboard = async () => {
      const [profileSnapshot, submissionSnapshot] = await Promise.all([
        getDocs(collection(db, 'codeDojo_users')),
        getDocs(query(collectionGroup(db, 'submissions'), orderBy('submittedAt', 'desc'))),
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

    loadDashboard().catch(() => {
      setProfiles([])
      setSubmissions([])
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

  return (
    <div className="modal-shell">
      <section className="admin-dashboard panel">
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
                <th>User</th>
                <th>Level</th>
                <th>XP</th>
                <th>Streak</th>
                <th>Joined</th>
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
                  <td>{formatDate(profile.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selectedUserId && (
          <section className="panel subtle">
            <div className="section-heading">
              <h3>Recent submissions</h3>
              <button
                id="admin-dashboard-hide-user"
                type="button"
                className="btn-ghost"
                onClick={() => setSelectedUserId(null)}
              >
                Hide
              </button>
            </div>

            <div className="stack-md">
              {selectedSubmissions.map((submission) => (
                <article key={submission.id} className="history-card">
                  <div className="meta-row">
                    <strong>{submission.exerciseTitle}</strong>
                    <span>{submission.score}/100</span>
                    <span>+{submission.xpEarned || 0} XP</span>
                    <span>{formatDate(submission.submittedAt)}</span>
                  </div>
                  <CodeEditor value={submission.code || ''} theme={theme} disabled />
                  <p className="message">{submission.feedback || 'No feedback'}</p>
                </article>
              ))}
            </div>
          </section>
        )}
      </section>
    </div>
  )
}
