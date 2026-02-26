import { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';

const API_KEY_STORAGE = 'codeDojoGeminiApiKey';
const SESSION_STORAGE = 'codeDojoSession';

const LEVELS = [
  { name: 'Stacktrace Squire', xpRequired: 0 },
  { name: 'Console Conjurer', xpRequired: 120 },
  { name: 'Regex Rogue', xpRequired: 260 },
  { name: 'Null Pointer Nomad', xpRequired: 430 },
  { name: 'Callback Commander', xpRequired: 620 },
  { name: 'Async Astronaut', xpRequired: 840 },
  { name: 'State Machine Sage', xpRequired: 1090 },
  { name: 'Refactor Revenant', xpRequired: 1370 },
  { name: 'Quantum Committer', xpRequired: 1680 },
  { name: 'Galactic Code Archon', xpRequired: 2020 },
];

const EXERCISES = [
  {
    id: 'easy-1',
    difficulty: 'easy',
    topics: ['array', 'map'],
    title: 'Map Names to Uppercase',
    description:
      'Given an array of names, return a new array where every name is uppercase using map.',
    starterCode: `function toUpperNames(names) {\n  // Your code here\n}\n\nconsole.log(toUpperNames(["ada", "grace", "linus"]));`,
    hint: 'Use names.map(name => name.toUpperCase()).',
    baseXp: 120,
  },
  {
    id: 'easy-2',
    difficulty: 'easy',
    topics: ['array', 'filter'],
    title: 'Filter Passing Scores',
    description: 'Return only scores that are >= 60 from an array using filter.',
    starterCode: `function getPassing(scores) {\n  // Your code here\n}\n\nconsole.log(getPassing([45, 78, 61, 20, 90]));`,
    hint: 'Use scores.filter(score => score >= 60).',
    baseXp: 120,
  },
  {
    id: 'medium-1',
    difficulty: 'medium',
    topics: ['array', 'reduce'],
    title: 'Group Todos by Status',
    description:
      'Convert an array of todo objects into an object with keys "done" and "pending", each containing arrays of todo titles.',
    starterCode: `function groupTodos(todos) {\n  // Your code here\n}\n\nconst todos = [\n  { title: "ship", done: true },\n  { title: "test", done: false },\n  { title: "docs", done: true }\n];\n\nconsole.log(groupTodos(todos));`,
    hint: 'Use reduce and push title into done/pending arrays.',
    baseXp: 180,
  },
  {
    id: 'medium-2',
    difficulty: 'medium',
    topics: ['function', 'async'],
    title: 'Debounce Utility',
    description:
      'Implement debounce(fn, delay) that postpones function execution until after delay ms have elapsed since the last call.',
    starterCode: `function debounce(fn, delay) {\n  // Your code here\n}\n\nconst ping = debounce(() => console.log("ping"), 200);`,
    hint: 'Return a function; clearTimeout + setTimeout inside closure.',
    baseXp: 180,
  },
  {
    id: 'hard-1',
    difficulty: 'hard',
    topics: ['recursion', 'memoization'],
    title: 'Memoized Fibonacci',
    description:
      'Write a memoized fibonacci function fib(n) that returns nth Fibonacci number with efficient recursion.',
    starterCode: `function createFib() {\n  // Your code here\n}\n\nconst fib = createFib();\nconsole.log(fib(20));`,
    hint: 'Use a cache object in closure and recursive helper.',
    baseXp: 240,
  },
  {
    id: 'hard-2',
    difficulty: 'hard',
    topics: ['events', 'data-structure'],
    title: 'Tiny Event Emitter',
    description:
      'Create an emitter with on(event, cb), off(event, cb), and emit(event, payload). Keep listeners isolated per event.',
    starterCode: `function createEmitter() {\n  // Your code here\n}\n\nconst emitter = createEmitter();`,
    hint: 'Store listeners in a map keyed by event name.',
    baseXp: 240,
  },
];

const DIFFICULTIES = ['easy', 'medium', 'hard'];
const TOPICS = [...new Set(EXERCISES.flatMap((exercise) => exercise.topics))].sort();

function getLevelMeta(totalXp) {
  let levelIndex = 0;
  for (let i = 0; i < LEVELS.length; i += 1) {
    if (totalXp >= LEVELS[i].xpRequired) levelIndex = i;
  }

  const current = LEVELS[levelIndex];
  const next = LEVELS[levelIndex + 1] ?? null;
  const progress = next
    ? ((totalXp - current.xpRequired) / (next.xpRequired - current.xpRequired)) * 100
    : 100;

  return { levelIndex, current, next, progress: Math.min(100, Math.max(0, progress)) };
}

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildSession({ selectedDifficulties, selectedTopics }) {
  const filtered = EXERCISES.filter((exercise) => {
    const difficultyMatch = selectedDifficulties.includes(exercise.difficulty);
    const topicMatch = selectedTopics.length === 0 || exercise.topics.some((topic) => selectedTopics.includes(topic));
    return difficultyMatch && topicMatch;
  });

  return shuffle(filtered).slice(0, 6);
}

const GEMINI_ENDPOINT = (apiKey) =>
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

async function verifyApiKey(apiKey) {
  const response = await fetch(GEMINI_ENDPOINT(apiKey), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: 'reply with ok' }] }],
    }),
  });

  if (!response.ok) {
    throw new Error('API key verification failed.');
  }
}
  
async function evaluateCode({ apiKey, exercise, code, hintUsed }) {
  const task = `${exercise.title} - ${exercise.description} (Hint used: ${hintUsed ? 'yes' : 'no'})`;

  const response = await fetch(GEMINI_ENDPOINT(apiKey), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: `Act as a concise JavaScript code reviewer. Task: ${task}. Code: ${code}. Return strictly a JSON object with keys "score" and "feedback". The "score" field MUST be a single integer between 0 and 100 representing the total percentage (e.g., 85, 100). NEVER return a score out of 5. feedback should be readable Markdown with short sections and bullet points.`,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error('Evaluation request failed.');
  }

  const data = await response.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';

  let parsed;
  try {
    parsed = JSON.parse(rawText.replace(/^```json\n?|\n?```$/g, ''));
  } catch {
    parsed = { score: 65, feedback: rawText || 'Evaluation returned an unexpected response format.' };
  }

  return {
    score: normalizeScore(parsed.score),
    feedback: formatFeedbackText(parsed.feedback || rawText),
  };
}

function normalizeScore(score) {
  if (!Number.isFinite(score)) return 65;
  if (score <= 10) return Math.round(score * 10);
  return Math.round(Math.max(0, Math.min(100, score)));
}

function formatFeedbackText(feedback) {
  if (!feedback) return 'No feedback received.';
  return String(feedback).replace(/^```markdown\n?|\n?```$/g, '').trim();
}

export default function App() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(API_KEY_STORAGE) || '');
  const [showModal, setShowModal] = useState(() => !localStorage.getItem(API_KEY_STORAGE));

  const [selectedDifficulties, setSelectedDifficulties] = useState([...DIFFICULTIES]);
  const [selectedTopics, setSelectedTopics] = useState([]);

  const [sessionExercises, setSessionExercises] = useState(() => buildSession({ selectedDifficulties: DIFFICULTIES, selectedTopics: [] }));
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [code, setCode] = useState(sessionExercises[0]?.starterCode ?? '');
  const [score, setScore] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalKeyInput, setModalKeyInput] = useState(apiKey);
  const [modalError, setModalError] = useState('');
  const [hintUsed, setHintUsed] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [totalXp, setTotalXp] = useState(0);
  const [earnedXp, setEarnedXp] = useState(null);

  const currentExercise = sessionExercises[exerciseIndex] ?? null;
  const levelMeta = useMemo(() => getLevelMeta(totalXp), [totalXp]);
  const unlockedLevels = levelMeta.levelIndex + 1;

  useEffect(() => {
    localStorage.setItem(SESSION_STORAGE, JSON.stringify(sessionExercises));
  }, [sessionExercises]);

  useEffect(() => {
    const refreshed = buildSession({ selectedDifficulties, selectedTopics });
    setSessionExercises(refreshed);
    setExerciseIndex(0);
    setCode(refreshed[0]?.starterCode ?? '');
    setScore(null);
    setFeedback('');
    setHintUsed(false);
    setShowHint(false);
    setEarnedXp(null);
  }, [selectedDifficulties, selectedTopics]);

  const resetForExercise = (nextIndex) => {
    const item = sessionExercises[nextIndex];
    setCode(item?.starterCode ?? '');
    setScore(null);
    setFeedback('');
    setHintUsed(false);
    setShowHint(false);
    setEarnedXp(null);
  };

  const handleDifficultyToggle = (difficulty) => {
    setSelectedDifficulties((prev) =>
      prev.includes(difficulty) ? prev.filter((item) => item !== difficulty) : [...prev, difficulty]
    );
  };

  const handleTopicToggle = (topic) => {
    setSelectedTopics((prev) =>
      prev.includes(topic) ? prev.filter((item) => item !== topic) : [...prev, topic]
    );
  };

  const handleVerify = async () => {
    setModalError('');
    if (!modalKeyInput.trim()) {
      setModalError('Please enter a Gemini API key.');
      return;
    }

    setIsVerifying(true);
    try {
      await verifyApiKey(modalKeyInput.trim());
      localStorage.setItem(API_KEY_STORAGE, modalKeyInput.trim());
      setApiKey(modalKeyInput.trim());
      setShowModal(false);
    } catch (error) {
      setModalError(error.message);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSubmit = async () => {
    if (!apiKey || !currentExercise) return;

    setIsSubmitting(true);
    try {
      const result = await evaluateCode({
        apiKey,
        exercise: currentExercise,
        code,
        hintUsed,
      });
      setScore(result.score);
      setFeedback(result.feedback);
      const xpMultiplier = hintUsed ? 0.65 : 1;
      const gained = Math.round(currentExercise.baseXp * (result.score / 100) * xpMultiplier);
      setTotalXp((prev) => prev + gained);
      setEarnedXp(gained);
    } catch (error) {
      setFeedback(error.message);
      setScore(0);
      setEarnedXp(0);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNext = () => {
    if (!sessionExercises.length) return;

    const next = exerciseIndex + 1;
    if (next >= sessionExercises.length) {
      const refreshed = buildSession({ selectedDifficulties, selectedTopics });
      setSessionExercises(refreshed);
      setExerciseIndex(0);
      setCode(refreshed[0]?.starterCode ?? '');
      setScore(null);
      setFeedback('');
      setHintUsed(false);
      setShowHint(false);
      setEarnedXp(null);
      return;
    }

    setExerciseIndex(next);
    resetForExercise(next);
  };

  return (
    <div className="app-shell">
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h2>Welcome to Code Dojo</h2>
            <p>
              Add your Gemini API key to unlock AI code feedback. Get one from{' '}
              <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">
                Google AI Studio
              </a>
              .
            </p>
            <input
              type="password"
              value={modalKeyInput}
              onChange={(event) => setModalKeyInput(event.target.value)}
              placeholder="Paste Gemini API key"
            />
            {modalError && <p className="error-text">{modalError}</p>}
            <button onClick={handleVerify} disabled={isVerifying}>
              {isVerifying ? 'Verifying...' : 'Save & Verify'}
            </button>
          </div>
        </div>
      )}

      <header className="topbar">
        <div>
          <h1>Code Dojo</h1>
          <p>
            {currentExercise ? currentExercise.difficulty.toUpperCase() : 'FILTERED'} challenge • Exercise{' '}
            {sessionExercises.length ? exerciseIndex + 1 : 0}/{sessionExercises.length}
          </p>
        </div>
        <div className="hud">
          <p className="level-title">
            Level {levelMeta.levelIndex + 1}: {levelMeta.current.name}
          </p>
          <p className="xp-line">
            {totalXp} XP{' '}
            {levelMeta.next
              ? `• ${levelMeta.next.xpRequired - totalXp} XP to ${levelMeta.next.name}`
              : '• Max level reached'}
          </p>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${levelMeta.progress}%` }} />
          </div>
          <div className="level-chip-row">
            {LEVELS.map((level, index) => {
              const status = index <= levelMeta.levelIndex ? 'unlocked' : 'locked';
              return (
                <span key={level.name} className={`level-chip ${status}`}>
                  L{index + 1}
                </span>
              );
            })}
          </div>
          <p className="level-unlock-line">{unlockedLevels}/{LEVELS.length} levels unlocked</p>
        </div>
      </header>

      <main className="split-layout">
        <section className="task-panel">
          <div className="filter-block">
            <h3>Difficulty</h3>
            <div className="filter-chip-row">
              {DIFFICULTIES.map((difficulty) => (
                <button
                  key={difficulty}
                  className={`filter-chip ${selectedDifficulties.includes(difficulty) ? 'active' : ''}`}
                  onClick={() => handleDifficultyToggle(difficulty)}
                >
                  {difficulty}
                </button>
              ))}
            </div>
            <h3>Topics</h3>
            <div className="filter-chip-row">
              {TOPICS.map((topic) => (
                <button
                  key={topic}
                  className={`filter-chip ${selectedTopics.includes(topic) ? 'active' : ''}`}
                  onClick={() => handleTopicToggle(topic)}
                >
                  {topic}
                </button>
              ))}
            </div>
          </div>

          {currentExercise ? (
            <>
              <h2>{currentExercise.title}</h2>
              <p>{currentExercise.description}</p>
              <button
                className="ghost-btn"
                onClick={() => {
                  setShowHint((prev) => !prev);
                  setHintUsed(true);
                }}
              >
                {showHint ? 'Hide Hint' : 'Use Hint (-35% XP)'}
              </button>
              {showHint && <div className="hint-box">💡 {currentExercise.hint}</div>}
            </>
          ) : (
            <div className="hint-box">No questions match your filters. Select more difficulties/topics.</div>
          )}
        </section>

        <section className="editor-panel">
          <textarea
            value={code}
            onChange={(event) => setCode(event.target.value)}
            spellCheck="false"
            disabled={!currentExercise}
          />
          <div className="controls">
            <button onClick={handleSubmit} disabled={isSubmitting || !apiKey || !currentExercise}>
              {isSubmitting ? 'Evaluating...' : 'Submit'}
            </button>
            <button className="ghost-btn" onClick={handleNext} disabled={!currentExercise}>
              Next Question
            </button>
          </div>
          {score !== null && (
            <div className="feedback-card">
              <h3>Score: {score}/100</h3>
              <div className="feedback-body">
                <ReactMarkdown>{feedback}</ReactMarkdown>
              </div>
              {earnedXp !== null && (
                <p className="xp-earned">+{earnedXp} XP earned {hintUsed ? '(hint penalty applied)' : ''}</p>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
