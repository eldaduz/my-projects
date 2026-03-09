import { useMemo, useState } from 'react'
import { formatFirestoreDate } from './utils'
import ModalShell from './ModalShell'

export default function UserProfile({ profile, submissions, bookmarkedExercises, onClose }) {
  const [page, setPage] = useState(0)
  const pageSize = 8
  const paginatedSubmissions = submissions.slice(page * pageSize, page * pageSize + pageSize)

  const stats = useMemo(() => {
    const solved = new Set()
    const attempted = new Set()

    submissions.forEach((submission) => {
      if (submission.score >= 60) {
        solved.add(submission.exerciseId)
      } else {
        attempted.add(submission.exerciseId)
      }
    })

    solved.forEach((exerciseId) => attempted.delete(exerciseId))

    return {
      solved: solved.size,
      attempted: attempted.size,
    }
  }, [submissions])

  return (
    <ModalShell className="user-profile panel" size="lg" onClose={onClose}>
      <div className="modal-header">
        <div className="modal-heading">
          <span className="eyebrow">Profile</span>
          <h2>{profile?.displayName || 'Anonymous'}</h2>
        </div>
        <button
          id="profile-close"
          type="button"
          className="btn-ghost modal-close-button"
          onClick={onClose}
        >
          Close
        </button>
      </div>

      <div className="modal-section profile-stats-grid">
        <article className="stat-card">
          <span className="eyebrow">XP</span>
          <strong>{profile?.totalXp || 0}</strong>
        </article>
        <article className="stat-card">
          <span className="eyebrow">Level</span>
          <strong>{profile?.levelName || 'White Belt'}</strong>
        </article>
        <article className="stat-card">
          <span className="eyebrow">Streak</span>
          <strong>{profile?.streak || 0} days</strong>
        </article>
        <article className="stat-card">
          <span className="eyebrow">Solved / Attempted</span>
          <strong>
            {stats.solved} / {stats.attempted}
          </strong>
        </article>
      </div>

      <div className="modal-section profile-layout">
        <section className="panel subtle">
          <h3>Bookmarks</h3>
          {bookmarkedExercises.length === 0 ? (
            <p className="message">No bookmarked exercises yet.</p>
          ) : (
            <div className="tag-row">
              {bookmarkedExercises.map((exercise) => (
                <span key={exercise.id} className="tag">
                  {exercise.title}
                </span>
              ))}
            </div>
          )}
        </section>

        <section className="panel subtle">
          <h3>Profile Summary</h3>
          <p className="message">
            Settings and API key management now live in the dedicated settings panel from the top
            bar.
          </p>
        </section>
      </div>

      <section className="panel subtle modal-section">
        <div className="modal-subheader">
          <h3>Submission History</h3>
          <div className="inline-actions">
            <button
              id="profile-prev-page"
              type="button"
              className="btn-ghost"
              disabled={page === 0}
              onClick={() => setPage((currentPage) => Math.max(0, currentPage - 1))}
            >
              Previous
            </button>
            <button
              id="profile-next-page"
              type="button"
              className="btn-ghost"
              disabled={(page + 1) * pageSize >= submissions.length}
              onClick={() => setPage((currentPage) => currentPage + 1)}
            >
              Next
            </button>
          </div>
        </div>

        <div className="stack-md">
          {paginatedSubmissions.map((submission, index) => (
            <article key={`${submission.exerciseId}-${index}`} className="history-card">
              <div className="exercise-card__top">
                <div>
                  <strong>{submission.exerciseTitle}</strong>
                  <div className="meta-row">
                    <span>{submission.score}/100</span>
                    <span>+{submission.xpEarned || 0} XP</span>
                    <span>{formatFirestoreDate(submission.submittedAt)}</span>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </ModalShell>
  )
}
