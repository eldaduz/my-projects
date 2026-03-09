# Code Dojo — Full Build Specification for Codex

> **Context:** This is a LeetCode-style JavaScript & React coding practice platform.
> The current app is a simple React+Vite SPA with 6 hardcoded exercises and a client-side Gemini API key.
> This document specifies the complete transformation into a full-featured platform with Firebase backend.

## Current Project Location

`c:\Fullstack\VS Code\code-dojo`

## Current Tech Stack

- React 18, Vite, JavaScript (JSX — not TypeScript)
- `react-markdown` for rendering feedback
- Deployed on Vercel
- No backend, no auth, no database

## Target Tech Stack

- React 18 + Vite (keep)
- Firebase Auth (email/password)
- Firebase Firestore (database)
- Firebase Cloud Functions (serverless backend)
- CodeMirror 6 (code editor)
- `react-markdown` (keep)
- CSS variables for dark/light theming

---

# PHASE 1 — Core Platform

## Step 1: Install Dependencies

```bash
npm install firebase @codemirror/state @codemirror/view @codemirror/lang-javascript @codemirror/theme-one-dark codemirror
```

## Step 2: Firebase Config

### Create `src/firebase.js`

```javascript
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions'

const firebaseConfig = {
  apiKey: 'AIzaSyBkSxr6-aRTijkqEM4Tt0RPu3l-_tpVof0',
  authDomain: 'eldad-portfolio-apps.firebaseapp.com',
  projectId: 'eldad-portfolio-apps',
  storageBucket: 'eldad-portfolio-apps.firebasestorage.app',
  messagingSenderId: '948254639000',
  appId: '1:948254639000:web:8cfb410cccd39bcb6461ed',
  measurementId: 'G-9KKE7V1TC0',
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const functions = getFunctions(app)

// Uncomment for local development:
// connectFunctionsEmulator(functions, 'localhost', 5001)
```

## Step 3: Cloud Function

### Create `functions/package.json`

```json
{
  "name": "code-dojo-functions",
  "main": "index.js",
  "type": "module",
  "engines": { "node": "20" },
  "dependencies": {
    "firebase-admin": "^13.0.0",
    "firebase-functions": "^6.3.0"
  }
}
```

### Create `functions/index.js`

This Cloud Function:

1. Verifies the caller is authenticated
2. Checks rate limit (max 50 submissions/day)
3. Reads the user's Gemini API key from Firestore `/users/{uid}/secrets/apiKey`
4. Calls Gemini API server-side with the evaluation prompt
5. Normalizes the score (handle Gemini returning score out of 5 vs 100)
6. Saves the submission to `/users/{uid}/submissions`
7. Updates user XP, level, and streak in `/users/{uid}/profile`
8. Updates exercise `solvedCount`/`attemptCount` in `/exercises/{id}`
9. Updates the leaderboard entry in `/leaderboard/{uid}`
10. Returns `{ score, feedback, xpEarned }`

````javascript
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

initializeApp()
const db = getFirestore()

const GEMINI_ENDPOINT = (apiKey) =>
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`

const LEVELS = [
  { name: 'White Belt', xpRequired: 0, emoji: '🤍', color: '#e0e0e0' },
  { name: 'Yellow Belt', xpRequired: 120, emoji: '💛', color: '#fbbf24' },
  { name: 'Orange Belt', xpRequired: 260, emoji: '🧡', color: '#f97316' },
  { name: 'Green Belt', xpRequired: 430, emoji: '💚', color: '#10b981' },
  { name: 'Blue Belt', xpRequired: 620, emoji: '💙', color: '#3b82f6' },
  { name: 'Purple Belt', xpRequired: 840, emoji: '💜', color: '#8b5cf6' },
  { name: 'Brown Belt', xpRequired: 1090, emoji: '🤎', color: '#a16207' },
  { name: 'Red Belt', xpRequired: 1370, emoji: '❤️', color: '#ef4444' },
  { name: 'Black Belt', xpRequired: 1680, emoji: '🖤', color: '#1f2937' },
  { name: 'Master Sensei', xpRequired: 2020, emoji: '⭐', color: '#f59e0b' },
]

function getLevelFromXp(totalXp) {
  let levelIndex = 0
  for (let i = 0; i < LEVELS.length; i++) {
    if (totalXp >= LEVELS[i].xpRequired) levelIndex = i
  }
  return { index: levelIndex, name: LEVELS[levelIndex].name }
}

function normalizeScore(score) {
  if (!Number.isFinite(score)) return 65
  if (score <= 10) return Math.round(score * 10)
  return Math.round(Math.max(0, Math.min(100, score)))
}

export const evaluateCode = onCall({ maxInstances: 10 }, async (request) => {
  // 1. Auth check
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be logged in.')
  }
  const uid = request.auth.uid

  // 2. Rate limit check
  const rateLimitRef = db.doc(`codeDojo_rateLimit/${uid}`)
  const rateLimitSnap = await rateLimitRef.get()
  const now = new Date()
  const today = now.toISOString().slice(0, 10)

  if (rateLimitSnap.exists) {
    const data = rateLimitSnap.data()
    if (data.lastReset === today && data.submissionsToday >= 50) {
      throw new HttpsError(
        'resource-exhausted',
        'Daily limit reached (50/day). Try again tomorrow.',
      )
    }
    if (data.lastReset !== today) {
      await rateLimitRef.set({ submissionsToday: 1, lastReset: today })
    } else {
      await rateLimitRef.update({ submissionsToday: FieldValue.increment(1) })
    }
  } else {
    await rateLimitRef.set({ submissionsToday: 1, lastReset: today })
  }

  // 3. Read user's API key
  const secretSnap = await db.doc(`codeDojo_users/${uid}/secrets/apiKey`).get()
  if (!secretSnap.exists || !secretSnap.data().key) {
    throw new HttpsError(
      'failed-precondition',
      'No API key saved. Add your Gemini API key in settings.',
    )
  }
  const apiKey = secretSnap.data().key

  // 4. Prepare and call Gemini
  const {
    exerciseId,
    exerciseTitle,
    exerciseDescription,
    testCases,
    code,
    hintUsed,
    baseXp,
    timeSpent,
  } = request.data

  const task = `${exerciseTitle} - ${exerciseDescription}`
  const testCaseStr = testCases ? `\nTest cases: ${JSON.stringify(testCases)}` : ''

  const prompt = `Act as a concise JavaScript code reviewer. Task: ${task}.${testCaseStr} Code: ${code}. Return strictly a JSON object with keys "score" and "feedback". The "score" field MUST be a single integer between 0 and 100 representing the total percentage (e.g., 85, 100). NEVER return a score out of 5. feedback should be readable Markdown with short sections and bullet points.`

  const response = await fetch(GEMINI_ENDPOINT(apiKey), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    if (errText.includes('API_KEY_INVALID') || errText.includes('API key not valid')) {
      throw new HttpsError(
        'permission-denied',
        'Your Gemini API key is invalid. Please update it in settings.',
      )
    }
    throw new HttpsError('internal', 'Gemini API request failed.')
  }

  const data = await response.json()
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''

  let parsed
  try {
    parsed = JSON.parse(rawText.replace(/^```json\n?|\n?```$/g, ''))
  } catch {
    parsed = {
      score: 65,
      feedback: rawText || 'Evaluation returned an unexpected response format.',
    }
  }

  const score = normalizeScore(parsed.score)
  const feedback = parsed.feedback
    ? String(parsed.feedback)
        .replace(/^```markdown\n?|\n?```$/g, '')
        .trim()
    : 'No feedback received.'

  // 5. Calculate XP
  const xpMultiplier = hintUsed ? 0.65 : 1
  const xpEarned = Math.round((baseXp || 120) * (score / 100) * xpMultiplier)

  // 6. Save submission
  const submissionData = {
    exerciseId,
    exerciseTitle,
    code,
    score,
    feedback,
    xpEarned,
    hintUsed: !!hintUsed,
    timeSpent: timeSpent || null,
    submittedAt: FieldValue.serverTimestamp(),
  }
  await db.collection(`codeDojo_users/${uid}/submissions`).add(submissionData)

  // 7. Update user profile (XP, level, streak)
  const profileRef = db.doc(`codeDojo_users/${uid}/profile`)
  const profileSnap = await profileRef.get()
  const currentXp = profileSnap.exists ? profileSnap.data().totalXp || 0 : 0
  const newTotalXp = currentXp + xpEarned
  const level = getLevelFromXp(newTotalXp)

  const lastPractice = profileSnap.exists ? profileSnap.data().lastPracticeDate : null
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().slice(0, 10)
  const currentStreak = profileSnap.exists ? profileSnap.data().streak || 0 : 0
  const newStreak =
    lastPractice === yesterdayStr ? currentStreak + 1 : lastPractice === today ? currentStreak : 1

  await profileRef.set(
    {
      totalXp: newTotalXp,
      level: level.index + 1,
      levelName: level.name,
      streak: newStreak,
      lastPracticeDate: today,
    },
    { merge: true },
  )

  // 8. Update exercise stats
  const exerciseRef = db.doc(`codeDojo_exercises/${exerciseId}`)
  const updateData = { attemptCount: FieldValue.increment(1) }
  if (score >= 60) {
    updateData.solvedCount = FieldValue.increment(1)
  }
  await exerciseRef.update(updateData).catch(() => {})

  // 9. Update leaderboard
  await db.doc(`codeDojo_leaderboard/${uid}`).set({
    displayName: profileSnap.exists ? profileSnap.data().displayName || 'Anonymous' : 'Anonymous',
    totalXp: newTotalXp,
    level: level.index + 1,
    levelName: level.name,
    streak: newStreak,
  })

  return { score, feedback, xpEarned }
})
````

## Step 4: Auth Context

### Create `src/AuthContext.jsx`

Provides authentication state to the entire app.

```javascript
import { createContext, useContext, useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { auth, db } from './firebase'

const AuthContext = createContext(null)

const ADMIN_EMAIL = 'eldaduz@gmail.com' // Replace with actual admin email

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const isAdmin = user?.email === ADMIN_EMAIL

  const login = async (email, password) => {
    return signInWithEmailAndPassword(auth, email, password)
  }

  const signup = async (email, password, displayName) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    await updateProfile(cred.user, { displayName })
    await setDoc(doc(db, `codeDojo_users/${cred.user.uid}/profile`), {
      email,
      displayName,
      totalXp: 0,
      level: 1,
      levelName: 'White Belt',
      streak: 0,
      lastPracticeDate: null,
      bookmarks: [],
      theme: 'dark',
      createdAt: new Date().toISOString(),
    })
    return cred
  }

  const logout = () => signOut(auth)

  const value = { user, loading, isAdmin, login, signup, logout }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
```

## Step 5: Auth Modal

### Create `src/AuthModal.jsx`

Sign up / Login modal with email + password. Tabs to switch between signup and login.

Requirements:

- Two tabs: "Sign In" and "Sign Up"
- Sign Up has: display name, email, password fields
- Sign In has: email, password fields
- Error display for invalid credentials
- Follows the new design system (warm charcoal + emerald/amber accents, NOT cyberpunk)
- Uses the `useAuth()` hook for `login()` and `signup()`

## Step 6: API Key Setup

### Create `src/ApiKeySetup.jsx`

A guided tutorial component shown after signup (or accessible from settings).

Requirements:

- Step-by-step visual guide:
  1. "Visit Google AI Studio" (link to https://aistudio.google.com/app/apikey)
  2. "Click 'Create API Key' and select a project"
  3. "Copy the key and paste it below"
- Password-type input field for the key
- "Save Key" button → writes to Firestore: `doc(db, 'codeDojo_users/{uid}/secrets/apiKey')` with `{ key: value }`
- Shows status: ✅ "API key saved" or ⚠️ "No API key yet"
- "Update Key" button to change the key later
- The saved key is NEVER read back from Firestore to the browser — only the Cloud Function reads it
- After saving, only show "Key saved ✅" and "Update Key" button (not the actual key value)

## Step 7: Exercise Data Module

### Create `src/exercises.js`

```javascript
import { collection, getDocs, doc, setDoc, deleteDoc, getDoc, writeBatch } from 'firebase/firestore'
import { db } from './firebase'

// Fallback exercises if Firestore is unreachable
export const BUILT_IN_EXERCISES = [
  // ... paste the 6 existing exercises from App.jsx here,
  // but add the new fields with defaults:
  // category: 'fundamentals',
  // testCases: [],
  // solutionApproach: '',
  // estimatedMinutes: 10,
  // solvedCount: 0,
  // attemptCount: 0,
]

export async function fetchExercises() {
  try {
    const snapshot = await getDocs(collection(db, 'codeDojo_exercises'))
    const exercises = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
    return exercises.length > 0 ? exercises : BUILT_IN_EXERCISES
  } catch {
    return BUILT_IN_EXERCISES
  }
}

export async function addExercise(exercise) {
  await setDoc(doc(db, 'codeDojo_exercises', exercise.id), exercise)
}

export async function deleteExercise(id) {
  await deleteDoc(doc(db, 'codeDojo_exercises', id))
}

export async function importExercises(exercises) {
  const batch = writeBatch(db)
  exercises.forEach((ex) => {
    batch.set(doc(db, 'codeDojo_exercises', ex.id), ex)
  })
  await batch.commit()
}

export async function exportExercises() {
  const exercises = await fetchExercises()
  return JSON.stringify(exercises, null, 2)
}
```

## Step 8: Modify `App.jsx`

Complete rewrite. The App component should:

1. **Remove**: `verifyApiKey()`, `evaluateCode()`, `GEMINI_ENDPOINT`, API key state, API key modal, all direct Gemini API calls, hardcoded EXERCISES/DIFFICULTIES/TOPICS
2. **Wrap** with `AuthProvider` in `main.jsx`
3. **If not logged in**: show `AuthModal`
4. **If logged in but no API key**: show `ApiKeySetup`
5. **If logged in with API key**: show the main app
6. **Fetch exercises** from Firestore on mount using `fetchExercises()`
7. **Derive** `DIFFICULTIES` and `TOPICS` dynamically: `[...new Set(exercises.map(e => e.difficulty))]` etc.
8. **Submit code** using Firebase callable function:
   ```javascript
   import { httpsCallable } from 'firebase/functions'
   import { functions } from './firebase'
   const evaluateCodeFn = httpsCallable(functions, 'evaluateCode')
   const result = await evaluateCodeFn({
     exerciseId,
     exerciseTitle,
     exerciseDescription,
     testCases,
     code,
     hintUsed,
     baseXp,
     timeSpent,
   })
   ```
9. **Admin controls**: if `isAdmin`, show "Manage Exercises" button → opens `ExerciseManager`
10. **Settings button** in topbar → opens `ApiKeySetup` for key update
11. Keep the existing XP/level display, progress bar, and level chips in the topbar
12. Keep the existing split-layout (task panel left, editor panel right)
13. Keep the existing hint system, difficulty/topic filters
14. Keep `react-markdown` for feedback rendering

## Step 9: Update `main.jsx`

```javascript
import React from 'react'
import ReactDOM from 'react-dom/client'
import { AuthProvider } from './AuthContext'
import App from './App'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
)
```

---

# PHASE 2 — Enhanced UX

## Step 10: CodeMirror Editor

### Create `src/CodeEditor.jsx`

Replace the `<textarea>` with CodeMirror 6.

Requirements:

- JavaScript/JSX syntax highlighting
- Line numbers
- Bracket matching, auto-indent
- Dark theme (use `@codemirror/theme-one-dark`)
- Light theme support (for later theme toggle)
- Controlled component: `value` prop + `onChange` callback
- Responsive height (min 54vh like current textarea)
- Monospace font matching current style

```javascript
import { useEffect, useRef } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { javascript } from '@codemirror/lang-javascript'
import { oneDark } from '@codemirror/theme-one-dark'
import { EditorState } from '@codemirror/state'

export default function CodeEditor({ value, onChange, disabled, theme = 'dark' }) {
  const editorRef = useRef(null)
  const viewRef = useRef(null)

  useEffect(() => {
    if (!editorRef.current) return

    const extensions = [
      basicSetup,
      javascript({ jsx: true }),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && onChange) {
          onChange(update.state.doc.toString())
        }
      }),
      EditorView.editable.of(!disabled),
    ]
    if (theme === 'dark') extensions.push(oneDark)

    const state = EditorState.create({ doc: value || '', extensions })
    const view = new EditorView({ state, parent: editorRef.current })
    viewRef.current = view

    return () => view.destroy()
  }, [disabled, theme]) // recreate on theme/disabled change

  // Sync external value changes
  useEffect(() => {
    const view = viewRef.current
    if (view && value !== view.state.doc.toString()) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: value || '' },
      })
    }
  }, [value])

  return <div ref={editorRef} className="code-editor-wrapper" />
}
```

Update `App.jsx`: replace `<textarea>` with `<CodeEditor value={code} onChange={setCode} disabled={!currentExercise} />`

## Step 11: Timer Component

### Create `src/Timer.jsx`

Requirements:

- Props: `minutes` (from exercise `estimatedMinutes`), `onExpire` callback, `running` boolean
- Countdown display: `MM:SS`
- Color changes: green (>50%), yellow (25-50%), red (<25%)
- Non-blocking — does NOT prevent submission when expired
- "Start Timer" button to begin
- Resets when exercise changes

## Step 12: Solution Reveal

In `App.jsx`, after a submission with score < 50, or when user clicks "Give Up":

- Show the exercise's `solutionApproach` field in a styled box
- "Give Up" button awards 0 XP, marks exercise as "attempted" (not "solved")
- Use a state variable `showSolution` toggled by either condition

## Step 13: Exercise List with Status Badges

### Create `src/ExerciseList.jsx`

Browse all exercises with visual status.

Requirements:

- Fetch user's submissions to determine status per exercise:
  - ✅ **Solved**: user has a submission with score >= 60
  - 🟡 **Attempted**: user has a submission with score < 60
  - ⚪ **Unsolved**: no submission
- Show: title, difficulty badge (color-coded), topics, category, estimated time, solve rate
- Filter by: difficulty, topic, category, status (solved/attempted/unsolved)
- Search by title
- Bookmark toggle (heart icon) → updates user profile `bookmarks[]` in Firestore
- Filter: "Bookmarked only"
- Click exercise → opens it in the editor panel

## Step 14: Daily Streaks

Handled by the Cloud Function (Step 3) on each submission:

- If `lastPracticeDate` is yesterday → increment streak
- If `lastPracticeDate` is today → keep streak
- Otherwise → reset streak to 1
- Streak bonus: if streak >= 7, multiply XP by 1.1 (show "+10% streak bonus")

In the **topbar**, show: "🔥 X day streak"

---

# PHASE 3 — Social & Admin

## Step 15: Exercise Manager (Admin Only)

### Create `src/ExerciseManager.jsx`

Requirements:

- Only rendered when `isAdmin` is true
- **Add Exercise Form** with fields:
  - `id` (auto-generated from title, kebab-case, editable)
  - `title` (text input)
  - `difficulty` (dropdown: easy/medium/hard)
  - `category` (dropdown: fundamentals/data-structures/algorithms/async/dom/react/patterns)
  - `topics` (comma-separated text input → split into array)
  - `description` (textarea, multiline)
  - `starterCode` (textarea/code editor, multiline)
  - `testCases` (JSON textarea — array of `{ input, expected, description }`)
  - `hint` (text input)
  - `solutionApproach` (textarea)
  - `baseXp` (number input, default by difficulty: easy=120, medium=180, hard=240)
  - `estimatedMinutes` (number input)
- **Validation**: require title, difficulty, description, starterCode
- **JSON Import**: file upload button → reads `.json` file → validates each exercise has required fields → calls `importExercises()`
- **JSON Export**: button → calls `exportExercises()` → triggers browser download of `code-dojo-exercises.json`
- **Exercise List**: all exercises from Firestore with:
  - Title, difficulty, category, topic tags
  - Delete button (with confirmation)
  - Solve rate stats (solvedCount/attemptCount)

## Step 16: Admin Dashboard

### Create `src/AdminDashboard.jsx`

Requirements:

- Only rendered when `isAdmin` is true
- **Users Table**: fetch all user profiles from Firestore
  - Columns: email, display name, level, XP, streak, exercises completed, joined date
  - Sort by: XP (desc), level, streak, name
  - Search by email or name
- **Click a user** → expand/modal showing their submissions:
  - Exercise title, submitted code (in CodeMirror read-only), score, feedback, XP earned, date
  - Sorted by date (newest first)
- **Summary stats at top**: total users, total submissions, average score, most popular exercise
- API keys are NOT shown anywhere — Firestore rules prevent reading `/secrets`

## Step 17: Leaderboard

### Create `src/Leaderboard.jsx`

Requirements:

- Read from `/leaderboard` collection (public read)
- Table: rank, display name, level title, XP, streak
- Top 50 users
- Highlight current user's row
- Accessible from topbar button

## Step 18: User Profile

### Create `src/UserProfile.jsx`

Requirements:

- Stats card: XP, level, streak, exercises solved/attempted
- Submission history (paginated, newest first)
- Bookmark management
- Settings:
  - Update display name
  - Update API key (links to `ApiKeySetup`)
  - Theme preference (dark/light)

## Step 19: Theme Toggle

### Create `src/ThemeContext.jsx`

```javascript
import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('codeDojo_theme')
    if (saved) return saved
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('codeDojo_theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}
```

Update `main.jsx` to wrap with `<ThemeProvider>`.

## Step 20: Complete Styles Redesign

### Modify `src/styles.css`

**IMPORTANT: The current styles have a cyberpunk/neon look. Replace it COMPLETELY with the design system below. The new look should feel like a professional game (think Duolingo / Chess.com), NOT a hacker terminal.**

#### Dark Theme (default) — CSS Variables under `:root`

```css
:root {
  /* Backgrounds — warm charcoal, NOT cold navy */
  --bg-primary: #1a1a2e;
  --bg-secondary: #222240;
  --bg-card: #2a2a4a;
  --bg-elevated: #323258;
  --bg-input: #1e1e3a;

  /* Text — warm white/cream */
  --text-primary: #f0ece2;
  --text-secondary: #b8b5ad;
  --text-muted: #8a8780;

  /* Emerald — primary actions, success */
  --emerald-500: #10b981;
  --emerald-400: #34d399;
  --emerald-600: #059669;

  /* Amber/Gold — XP, rewards */
  --amber-500: #f59e0b;
  --amber-400: #fbbf24;
  --amber-600: #d97706;

  /* Coral — errors, hard difficulty */
  --coral-500: #f97066;
  --coral-400: #fca5a1;

  /* Difficulty badges */
  --easy-bg: rgba(16, 185, 129, 0.15);
  --easy-text: #34d399;
  --easy-border: rgba(16, 185, 129, 0.3);
  --medium-bg: rgba(245, 158, 11, 0.15);
  --medium-text: #fbbf24;
  --medium-border: rgba(245, 158, 11, 0.3);
  --hard-bg: rgba(249, 112, 102, 0.15);
  --hard-text: #fca5a1;
  --hard-border: rgba(249, 112, 102, 0.3);

  /* Borders — subtle and warm */
  --border-subtle: rgba(255, 255, 255, 0.08);
  --border-default: rgba(255, 255, 255, 0.12);
  --border-strong: rgba(255, 255, 255, 0.2);

  /* Shadows */
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.5);

  /* Progress */
  --progress-bg: #2a2a4a;
  --progress-fill: linear-gradient(90deg, #f59e0b, #fbbf24);
  --xp-color: #fbbf24;
  --streak-color: #ff6b35;
}
```

#### Light Theme — CSS Variables under `[data-theme="light"]`

```css
[data-theme='light'] {
  --bg-primary: #faf8f5;
  --bg-secondary: #f0ece2;
  --bg-card: #ffffff;
  --bg-elevated: #ffffff;
  --bg-input: #f5f2ed;
  --text-primary: #2d2a26;
  --text-secondary: #5c5955;
  --text-muted: #9a9590;
  --border-subtle: rgba(0, 0, 0, 0.06);
  --border-default: rgba(0, 0, 0, 0.1);
  --border-strong: rgba(0, 0, 0, 0.18);
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.08);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.15);
  --progress-bg: #e8e4dc;
}
```

#### Component Style Requirements

- ALL components must use CSS variables (no hardcoded colors anywhere)
- Cards: `border-radius: 16px`, `box-shadow: var(--shadow-md)`, `background: var(--bg-card)`
- Buttons:
  - Primary: `background: var(--emerald-500)`, white text, `border-radius: 10px`
  - Secondary: outlined with `var(--border-default)`
  - Ghost: transparent with subtle hover
- Difficulty badges: pill-shaped, color-coded (green=easy, amber=medium, coral=hard)
- XP progress bar: golden gradient fill
- Score display: circular progress ring (green ≥80, amber 50-79, coral <50)
- Topbar: belt badge with belt color, streak 🔥 counter
- Smooth `transition: all 0.2s ease` on interactive elements
- Responsive: collapse to single column under 768px
- Font: Inter (Google Fonts)

#### New component classes needed

`.auth-modal`, `.api-key-setup`, `.code-editor-wrapper`, `.timer`, `.exercise-list`, `.exercise-card`, `.exercise-manager`, `.admin-dashboard`, `.leaderboard`, `.user-profile`, `.theme-toggle`, `.solution-box`, `.streak-badge`, `.belt-badge`, `.score-ring`, `.difficulty-pill`

## Step 21: Update `index.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta
      name="description"
      content="Code Dojo — Practice JavaScript & React with AI-powered code review"
    />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
      rel="stylesheet"
    />
    <title>Code Dojo — JS & React Practice</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

---

# Firestore Security Rules

Deploy these in Firebase Console → Firestore → Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAdmin() {
      // EXACT EMAIL MATCH: The admin's email goes here
      return request.auth != null && request.auth.token.email == 'eldaduz@gmail.com';
    }

    match /codeDojo_exercises/{id} {
      allow read: if true;
      allow write: if isAdmin();
    }
    match /codeDojo_users/{uid}/profile {
      allow read, write: if request.auth != null && request.auth.uid == uid;
      allow read: if isAdmin();
    }
    match /codeDojo_users/{uid}/submissions/{sub} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
      allow read: if isAdmin();
    }
    match /codeDojo_users/{uid}/secrets/{doc} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
      // Admin explicitly CANNOT access this
    }
    match /codeDojo_leaderboard/{uid} {
      allow read: if true;
      // Only Cloud Function writes (uses admin SDK, bypasses rules)
    }
    match /codeDojo_rateLimit/{uid} {
      // Only Cloud Function accesses this
    }
  }
}
```

---

# Exercise Generation Guide

A ready-to-use AI prompt is saved in `EXERCISE_GENERATION_GUIDE.md` in the project root.
Use it with any AI (GPT, Gemini, Claude) to bulk-generate exercises as JSON, then import via the admin Exercise Manager.

---

# Design Requirements

**CRITICAL: The current cyberpunk/neon aesthetic must be COMPLETELY replaced. The new design is a professional game UI — warm, inviting, clean.**

- **Theme**: Warm charcoal dark (default) + cream/white light mode. NOT cold navy/purple neon.
- **Primary color**: Emerald green (`#10b981`) for buttons, success, primary actions
- **Reward color**: Amber/gold (`#f59e0b`) for XP, levels, progress bars
- **Error color**: Soft coral (`#f97066`) for errors, hard difficulty
- **Cards**: Solid backgrounds with subtle warm borders and shadows. NO glassmorphism.
- **Level system**: Martial arts belt ranks 🥋 (White Belt → Master Sensei) with belt color indicators
- **Buttons**: Solid colored (not gradients), rounded (10px), with subtle hover darkening
- **Score display**: Circular progress ring, not just text
- **XP earned**: Golden ✨ with subtle animation
- **Streak**: 🔥 badge with count
- **Micro-animations**: Smooth transitions (0.2s ease), hover effects, no flashy neon animations
- **Responsive**: Mobile-first, single column under 768px
- **Typography**: Inter font, clear hierarchy (700 headings, 400 body)
- All interactive elements must have unique IDs for testing
- CSS variable-based theming for instant dark/light switch
