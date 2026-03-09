function getSolveRate(exercise) {
  if (!exercise.attemptCount) return 'New'
  return `${Math.round((exercise.solvedCount / exercise.attemptCount) * 100)}% solve rate`
}

export default function ExerciseList({
  exercises,
  currentExerciseId,
  statusMap,
  bookmarks,
  filters,
  onFilterChange,
  onSelectExercise,
  onToggleBookmark,
  onClose,
}) {
  const statusIcon = {
    solved: '✅',
    attempted: '🟡',
    unsolved: '○',
  }

  return (
    <section className="exercise-list panel">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Exercise Browser</span>
          <h2>Choose your next challenge</h2>
        </div>
        {onClose ? (
          <button type="button" className="btn-ghost" onClick={onClose}>
            Close
          </button>
        ) : null}
      </div>

      <div className="filter-grid exercise-filters">
        <label className="field">
          <span>Search</span>
          <input
            id="exercise-search"
            type="search"
            value={filters.search}
            onChange={(event) => onFilterChange('search', event.target.value)}
            placeholder="Search title"
          />
        </label>

        <label className="field">
          <span>Difficulty</span>
          <select
            id="exercise-difficulty-filter"
            value={filters.difficulty}
            onChange={(event) => onFilterChange('difficulty', event.target.value)}
          >
            <option value="all">All</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </label>

        <label className="field">
          <span>Topic</span>
          <select
            id="exercise-topic-filter"
            value={filters.topic}
            onChange={(event) => onFilterChange('topic', event.target.value)}
          >
            <option value="all">All</option>
            {filters.availableTopics.map((topic) => (
              <option key={topic} value={topic}>
                {topic}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Category</span>
          <select
            id="exercise-category-filter"
            value={filters.category}
            onChange={(event) => onFilterChange('category', event.target.value)}
          >
            <option value="all">All</option>
            {filters.availableCategories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Status</span>
          <select
            id="exercise-status-filter"
            value={filters.status}
            onChange={(event) => onFilterChange('status', event.target.value)}
          >
            <option value="all">All</option>
            <option value="solved">Solved</option>
            <option value="attempted">Attempted</option>
            <option value="unsolved">Unsolved</option>
          </select>
        </label>

        <label className="checkbox-field">
          <input
            id="exercise-bookmarked-filter"
            type="checkbox"
            checked={filters.bookmarkedOnly}
            onChange={(event) => onFilterChange('bookmarkedOnly', event.target.checked)}
          />
          <span>Bookmarked only</span>
        </label>
      </div>

      <div className="stack-md">
        {exercises.map((exercise) => {
          const status = statusMap[exercise.id] || 'unsolved'
          const isBookmarked = bookmarks.includes(exercise.id)

          return (
            <article
              key={exercise.id}
              className={`exercise-card ${currentExerciseId === exercise.id ? 'selected' : ''}`}
            >
              <div className="exercise-card__top">
                <button
                  id={`select-${exercise.id}`}
                  type="button"
                  className="exercise-link"
                  onClick={() => onSelectExercise(exercise.id)}
                >
                  <div className="exercise-link-copy">
                    <div className="exercise-status-line">
                      <span className="status-icon" aria-hidden="true">
                        {statusIcon[status]}
                      </span>
                      <strong>{exercise.title}</strong>
                    </div>
                    <div className="exercise-subtitle">
                      <span className={`difficulty-pill ${exercise.difficulty}`}>
                        {exercise.difficulty}
                      </span>
                      <span>{exercise.topics.slice(0, 2).join(', ')}</span>
                    </div>
                  </div>
                </button>

                <button
                  id={`bookmark-${exercise.id}`}
                  type="button"
                  className={`bookmark-button ${isBookmarked ? 'active' : ''}`}
                  onClick={() => onToggleBookmark(exercise.id)}
                >
                  {isBookmarked ? '♥' : '♡'}
                </button>
              </div>

              <div className="meta-row">
                <span>{exercise.baseXp} XP</span>
                <span>{exercise.estimatedMinutes} min</span>
                <span>{getSolveRate(exercise)}</span>
              </div>

              <div className="tag-row">
                {exercise.topics.map((topic) => (
                  <span key={topic} className="tag">
                    {topic}
                  </span>
                ))}
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
