import { useMemo, useState } from 'react'
import { formatFirestoreDate } from './utils'
import ModalShell from './ModalShell'
import { getLevelMeta } from './levels'
import RankHoverCard from './RankHoverCard'

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

  const levelMeta = getLevelMeta(profile?.totalXp || 0)

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
        <article className="stat-card stat-card--rank">
          <span className="eyebrow">Level</span>
          <RankHoverCard
            totalXp={profile?.totalXp || 0}
            triggerClassName="stat-rank-trigger"
            triggerStyle={{ '--belt-color': levelMeta.current.color }}
            triggerLabel={`Current rank: ${profile?.levelName || 'White Belt'}`}
            triggerContent={<strong>{profile?.levelName || 'White Belt'}</strong>}
          />
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
        <section className="panel subtle profile-info-card">
          <h3>Bookmarks</h3>
          {bookmarkedExercises.length === 0 ? (
            <p className="message profile-info-copy">No bookmarked exercises yet.</p>
          ) : (
            <div className="tag-row profile-info-copy">
              {bookmarkedExercises.map((exercise) => (
                <span key={exercise.id} className="tag">
                  {exercise.title}
                </span>
              ))}
            </div>
          )}
        </section>

        <section className="panel subtle profile-info-card">
          <h3>Profile Summary</h3>
          <p className="message profile-info-copy">
            Settings and API key management now live in the dedicated settings panel from the top
            bar.
          </p>
        </section>
      </div>

      <section className="panel subtle modal-section profile-history-section">
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

        {paginatedSubmissions.length === 0 ? (
          <p className="message profile-history-empty">No submissions yet. Start practicing to see your history here.</p>
        ) : (
          <div className="stack-md profile-history-list">
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
        )}
      </section>
    </ModalShell>
  )
}
