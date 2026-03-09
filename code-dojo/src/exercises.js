import { collection, deleteDoc, doc, getDocs, setDoc, writeBatch } from 'firebase/firestore'
import { db } from './firebase'

const REQUIRED_IMPORT_FIELDS = [
  'id',
  'title',
  'difficulty',
  'category',
  'description',
  'starterCode',
]

export const BUILT_IN_EXERCISES = [
  {
    id: 'easy-1',
    title: 'Map Names to Uppercase',
    difficulty: 'easy',
    category: 'fundamentals',
    topics: ['array', 'map'],
    description:
      'Given an array of names, return a new array where every name is uppercase using map.',
    starterCode:
      'function toUpperNames(names) {\n  // Your code here\n}\n\nconsole.log(toUpperNames(["ada", "grace", "linus"]));',
    testCases: [
      { input: ['ada', 'grace'], expected: ['ADA', 'GRACE'], description: 'Uppercase each name' },
    ],
    hint: 'Use names.map(name => name.toUpperCase()).',
    solutionApproach:
      'Use `Array.prototype.map` to transform each string and return a new array without mutating the original input.',
    baseXp: 120,
    estimatedMinutes: 10,
    solvedCount: 0,
    attemptCount: 0,
  },
  {
    id: 'easy-2',
    title: 'Filter Passing Scores',
    difficulty: 'easy',
    category: 'fundamentals',
    topics: ['array', 'filter'],
    description: 'Return only scores that are greater than or equal to 60 from an array.',
    starterCode:
      'function getPassing(scores) {\n  // Your code here\n}\n\nconsole.log(getPassing([45, 78, 61, 20, 90]));',
    testCases: [
      {
        input: [45, 78, 61, 20, 90],
        expected: [78, 61, 90],
        description: 'Keep only passing scores',
      },
    ],
    hint: 'Use scores.filter(score => score >= 60).',
    solutionApproach:
      'Use `Array.prototype.filter` with a predicate that keeps only values meeting the score threshold.',
    baseXp: 120,
    estimatedMinutes: 10,
    solvedCount: 0,
    attemptCount: 0,
  },
  {
    id: 'medium-1',
    title: 'Group Todos by Status',
    difficulty: 'medium',
    category: 'data-structures',
    topics: ['array', 'reduce'],
    description:
      'Convert an array of todo objects into an object with keys `done` and `pending`, each containing arrays of todo titles.',
    starterCode:
      'function groupTodos(todos) {\n  // Your code here\n}\n\nconst todos = [\n  { title: "ship", done: true },\n  { title: "test", done: false },\n  { title: "docs", done: true }\n]\n\nconsole.log(groupTodos(todos));',
    testCases: [
      {
        input: [
          { title: 'ship', done: true },
          { title: 'test', done: false },
        ],
        expected: { done: ['ship'], pending: ['test'] },
        description: 'Bucket todos by completion state',
      },
    ],
    hint: 'Use reduce to accumulate done and pending arrays.',
    solutionApproach:
      'Create an accumulator with `done` and `pending` arrays, then reduce over the todos and push each title into the correct bucket.',
    baseXp: 180,
    estimatedMinutes: 15,
    solvedCount: 0,
    attemptCount: 0,
  },
  {
    id: 'medium-2',
    title: 'Debounce Utility',
    difficulty: 'medium',
    category: 'async',
    topics: ['function', 'async'],
    description:
      'Implement `debounce(fn, delay)` so repeated calls collapse into one final invocation after the delay.',
    starterCode:
      'function debounce(fn, delay) {\n  // Your code here\n}\n\nconst ping = debounce(() => console.log("ping"), 200)',
    testCases: [
      {
        input: 'Call the returned function three times in quick succession.',
        expected: 'Only the final scheduled callback runs after the delay.',
        description: 'Debounce collapses rapid events',
      },
    ],
    hint: 'Keep the timeout handle in a closure and clear it before scheduling a new timeout.',
    solutionApproach:
      'Return a function that stores the timer in closure scope, clears the previous timer, and schedules a fresh one that calls the original function.',
    baseXp: 180,
    estimatedMinutes: 18,
    solvedCount: 0,
    attemptCount: 0,
  },
  {
    id: 'hard-1',
    title: 'Memoized Fibonacci',
    difficulty: 'hard',
    category: 'algorithms',
    topics: ['recursion', 'memoization'],
    description:
      'Write a memoized Fibonacci implementation that avoids repeated recursive work for the same inputs.',
    starterCode:
      'function createFib() {\n  // Your code here\n}\n\nconst fib = createFib()\nconsole.log(fib(20))',
    testCases: [{ input: 10, expected: 55, description: 'Return the 10th Fibonacci number' }],
    hint: 'Store computed results in a cache object inside the closure.',
    solutionApproach:
      'Create a cache in the outer function and return a recursive helper that checks cached values before computing and storing new results.',
    baseXp: 240,
    estimatedMinutes: 22,
    solvedCount: 0,
    attemptCount: 0,
  },
  {
    id: 'hard-2',
    title: 'Tiny Event Emitter',
    difficulty: 'hard',
    category: 'patterns',
    topics: ['events', 'data-structure'],
    description:
      'Create an emitter with `on`, `off`, and `emit` methods while isolating listeners by event name.',
    starterCode:
      'function createEmitter() {\n  // Your code here\n}\n\nconst emitter = createEmitter()',
    testCases: [
      {
        input: 'Register two listeners for one event and emit once.',
        expected: 'Both callbacks receive the payload exactly once.',
        description: 'Listeners are stored per event',
      },
    ],
    hint: 'Keep a map or object keyed by event names.',
    solutionApproach:
      'Track a listener collection for each event name. Add and remove callbacks from those collections and iterate only the matching list when emitting.',
    baseXp: 240,
    estimatedMinutes: 25,
    solvedCount: 0,
    attemptCount: 0,
  },
]

export async function fetchExercises() {
  try {
    const snapshot = await getDocs(collection(db, 'codeDojo_exercises'))
    const exercises = snapshot.docs.map((documentSnapshot) => ({
      id: documentSnapshot.id,
      ...documentSnapshot.data(),
    }))
    return exercises.length > 0 ? exercises : BUILT_IN_EXERCISES
  } catch {
    return BUILT_IN_EXERCISES
  }
}

export const addExercise = (exercise) =>
  setDoc(doc(db, 'codeDojo_exercises', exercise.id), exercise)
export const deleteExercise = (id) => deleteDoc(doc(db, 'codeDojo_exercises', id))

export function normalizeExerciseImportPayload(payload) {
  const entries = Array.isArray(payload) ? payload : [payload]

  if (!entries.length) {
    throw new Error('Imported file must contain at least one exercise.')
  }

  return entries.map((exercise, index) => {
    if (!exercise || typeof exercise !== 'object' || Array.isArray(exercise)) {
      throw new Error(`Exercise ${index + 1} must be a JSON object.`)
    }

    const missingField = REQUIRED_IMPORT_FIELDS.find(
      (field) => !String(exercise[field] ?? '').trim(),
    )
    if (missingField) {
      throw new Error(`Exercise ${index + 1} is missing required field "${missingField}".`)
    }

    return {
      ...exercise,
      id: String(exercise.id).trim(),
      title: String(exercise.title).trim(),
      difficulty: String(exercise.difficulty).trim(),
      category: String(exercise.category).trim(),
      description: String(exercise.description).trim(),
      starterCode: String(exercise.starterCode),
      topics: Array.isArray(exercise.topics)
        ? exercise.topics.map((topic) => String(topic).trim()).filter(Boolean)
        : [],
      testCases: Array.isArray(exercise.testCases) ? exercise.testCases : [],
      hint: String(exercise.hint || ''),
      solutionApproach: String(exercise.solutionApproach || ''),
      baseXp: Number(exercise.baseXp) || 120,
      estimatedMinutes: Number(exercise.estimatedMinutes) || 10,
      solvedCount: Number(exercise.solvedCount) || 0,
      attemptCount: Number(exercise.attemptCount) || 0,
    }
  })
}

export async function importExercises(exercises) {
  const BATCH_SIZE = 500
  for (let i = 0; i < exercises.length; i += BATCH_SIZE) {
    const batch = writeBatch(db)
    exercises.slice(i, i + BATCH_SIZE).forEach((exercise) => {
      batch.set(doc(db, 'codeDojo_exercises', exercise.id), exercise)
    })
    await batch.commit()
  }
}

export async function exportExercises() {
  const exercises = await fetchExercises()
  return JSON.stringify(exercises, null, 2)
}
