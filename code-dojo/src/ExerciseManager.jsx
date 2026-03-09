import { useMemo, useState } from 'react'
import {
  addExercise,
  deleteExercise,
  exportExercises,
  importExercises,
  normalizeExerciseImportPayload,
} from './exercises'
import ModalShell from './ModalShell'

const CATEGORIES = [
  'fundamentals',
  'data-structures',
  'algorithms',
  'async',
  'dom',
  'react',
  'patterns',
]

const EMPTY_FORM = {
  id: '',
  title: '',
  difficulty: 'easy',
  category: 'fundamentals',
  topics: '',
  description: '',
  starterCode: '',
  testCases: '[]',
  hint: '',
  solutionApproach: '',
  baseXp: 120,
  estimatedMinutes: 10,
}

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function defaultXpForDifficulty(difficulty) {
  if (difficulty === 'medium') return 180
  if (difficulty === 'hard') return 240
  return 120
}

export default function ExerciseManager({ exercises, onClose, onRefresh }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const sortedExercises = useMemo(
    () => [...exercises].sort((left, right) => left.title.localeCompare(right.title)),
    [exercises],
  )

  const updateForm = (field, value) => {
    setForm((currentForm) => {
      const nextForm = { ...currentForm, [field]: value }
      if (field === 'title' && (!currentForm.id || currentForm.id === slugify(currentForm.title))) {
        nextForm.id = slugify(value)
      }
      if (field === 'difficulty') {
        nextForm.baseXp = defaultXpForDifficulty(value)
      }
      return nextForm
    })
  }

  const handleCreate = async (event) => {
    event.preventDefault()
    setError('')

    if (!form.title || !form.difficulty || !form.description || !form.starterCode) {
      setError('Title, difficulty, description, and starter code are required.')
      return
    }

    let testCases
    try {
      testCases = JSON.parse(form.testCases || '[]')
    } catch {
      setError('Test cases must be valid JSON.')
      return
    }

    setBusy(true)
    try {
      await addExercise({
        id: form.id || slugify(form.title),
        title: form.title,
        difficulty: form.difficulty,
        category: form.category,
        topics: form.topics
          .split(',')
          .map((topic) => topic.trim())
          .filter(Boolean),
        description: form.description,
        starterCode: form.starterCode,
        testCases,
        hint: form.hint,
        solutionApproach: form.solutionApproach,
        baseXp: Number(form.baseXp) || defaultXpForDifficulty(form.difficulty),
        estimatedMinutes: Number(form.estimatedMinutes) || 10,
        solvedCount: 0,
        attemptCount: 0,
      })
      setForm(EMPTY_FORM)
      await onRefresh()
    } catch (createError) {
      setError(createError.message || 'Failed to create exercise.')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this exercise?')) return
    setBusy(true)
    try {
      await deleteExercise(id)
      await onRefresh()
    } finally {
      setBusy(false)
    }
  }

  const handleImport = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setError('')
    try {
      const parsed = JSON.parse(await file.text())
      await importExercises(normalizeExerciseImportPayload(parsed))
      await onRefresh()
    } catch (importError) {
      setError(importError.message || 'Failed to import exercises.')
    } finally {
      event.target.value = ''
    }
  }

  const handleExport = async () => {
    const content = await exportExercises()
    const blob = new Blob([content], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'code-dojo-exercises.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <ModalShell className="exercise-manager panel" size="lg" onClose={onClose}>
      <div className="modal-header">
        <div className="modal-heading">
          <span className="eyebrow">Admin</span>
          <h2>Exercise Manager</h2>
        </div>
        <button
          id="exercise-manager-close"
          type="button"
          className="btn-ghost modal-close-button"
          onClick={onClose}
        >
          Close
        </button>
      </div>

      <form className="manager-grid modal-section" onSubmit={handleCreate}>
        <label className="field">
          <span>Title</span>
          <input
            id="exercise-form-title"
            value={form.title}
            onChange={(event) => updateForm('title', event.target.value)}
          />
        </label>
        <label className="field">
          <span>Id</span>
          <input
            id="exercise-form-id"
            value={form.id}
            onChange={(event) => updateForm('id', event.target.value)}
          />
        </label>
        <label className="field">
          <span>Difficulty</span>
          <select
            id="exercise-form-difficulty"
            value={form.difficulty}
            onChange={(event) => updateForm('difficulty', event.target.value)}
          >
            <option value="easy">easy</option>
            <option value="medium">medium</option>
            <option value="hard">hard</option>
          </select>
        </label>
        <label className="field">
          <span>Category</span>
          <select
            id="exercise-form-category"
            value={form.category}
            onChange={(event) => updateForm('category', event.target.value)}
          >
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
        <label className="field field--wide">
          <span>Topics</span>
          <input
            id="exercise-form-topics"
            value={form.topics}
            onChange={(event) => updateForm('topics', event.target.value)}
          />
        </label>
        <label className="field field--wide">
          <span>Description</span>
          <textarea
            id="exercise-form-description"
            rows="4"
            value={form.description}
            onChange={(event) => updateForm('description', event.target.value)}
          />
        </label>
        <label className="field field--wide">
          <span>Starter Code</span>
          <textarea
            id="exercise-form-starter-code"
            rows="5"
            value={form.starterCode}
            onChange={(event) => updateForm('starterCode', event.target.value)}
          />
        </label>
        <label className="field field--wide">
          <span>Test Cases (JSON)</span>
          <textarea
            id="exercise-form-test-cases"
            rows="5"
            value={form.testCases}
            onChange={(event) => updateForm('testCases', event.target.value)}
          />
        </label>
        <label className="field">
          <span>Hint</span>
          <input
            id="exercise-form-hint"
            value={form.hint}
            onChange={(event) => updateForm('hint', event.target.value)}
          />
        </label>
        <label className="field field--wide">
          <span>Solution Approach</span>
          <textarea
            id="exercise-form-solution"
            rows="4"
            value={form.solutionApproach}
            onChange={(event) => updateForm('solutionApproach', event.target.value)}
          />
        </label>
        <label className="field">
          <span>Base XP</span>
          <input
            id="exercise-form-base-xp"
            type="number"
            value={form.baseXp}
            onChange={(event) => updateForm('baseXp', event.target.value)}
          />
        </label>
        <label className="field">
          <span>Estimated Minutes</span>
          <input
            id="exercise-form-estimated-minutes"
            type="number"
            value={form.estimatedMinutes}
            onChange={(event) => updateForm('estimatedMinutes', event.target.value)}
          />
        </label>

        {error && <p className="message error field--wide">{error}</p>}

        <div className="inline-actions field--wide">
          <button id="exercise-form-submit" type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Saving...' : 'Add Exercise'}
          </button>
          <label className="btn-secondary file-button" htmlFor="exercise-import-file">
            Import JSON
          </label>
          <input
            id="exercise-import-file"
            type="file"
            accept=".json,application/json"
            hidden
            onChange={handleImport}
          />
          <button
            id="exercise-export"
            type="button"
            className="btn-secondary"
            onClick={handleExport}
          >
            Export JSON
          </button>
        </div>
      </form>

      <div className="modal-body stack-md">
        {sortedExercises.map((exercise) => (
          <article key={exercise.id} className="exercise-card admin-card">
            <div className="exercise-card__top">
              <div>
                <strong>{exercise.title}</strong>
                <div className="meta-row">
                  <span className={`difficulty-pill ${exercise.difficulty}`}>
                    {exercise.difficulty}
                  </span>
                  <span>{exercise.category}</span>
                  <span>
                    {exercise.solvedCount || 0}/{exercise.attemptCount || 0} solved
                  </span>
                </div>
              </div>
              <button
                id={`delete-${exercise.id}`}
                type="button"
                className="btn-ghost danger"
                onClick={() => handleDelete(exercise.id)}
              >
                Delete
              </button>
            </div>
          </article>
        ))}
      </div>
    </ModalShell>
  )
}
