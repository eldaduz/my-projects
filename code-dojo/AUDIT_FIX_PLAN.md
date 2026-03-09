# Code Dojo — Audit Fix Plan

> Based on the skill-based code review (27 findings).
> Phases are ordered by severity. Each has exact code changes.

---

## Phase 1 — Critical Bugs (Fix First)

### 1.1 Fix CodeEditor Recreation on Keystroke

#### [MODIFY] `src/CodeEditor.jsx`

Replace the `onChange` dependency with a `useRef` pattern:

```diff
-import { useEffect, useRef } from 'react'
+import { useEffect, useRef, useCallback } from 'react'

 export default function CodeEditor({ value, onChange, disabled, theme = 'dark' }) {
   const editorRef = useRef(null)
   const viewRef = useRef(null)
+  const onChangeRef = useRef(onChange)
+  onChangeRef.current = onChange

   useEffect(() => {
     if (!editorRef.current) return undefined
     const state = EditorState.create({
       doc: value || '',
       extensions: [
         basicSetup,
         javascript({ jsx: true }),
         EditorView.lineWrapping,
         EditorView.updateListener.of((update) => {
-          if (update.docChanged && onChange) {
-            onChange(update.state.doc.toString())
+          if (update.docChanged && onChangeRef.current) {
+            onChangeRef.current(update.state.doc.toString())
           }
         }),
         EditorView.editable.of(!disabled),
         theme === 'dark' ? oneDark : lightTheme,
       ],
     })
     const view = new EditorView({ state, parent: editorRef.current })
     viewRef.current = view
     return () => view.destroy()
-  }, [disabled, onChange, theme])
+  }, [disabled, theme])
```

### 1.2 Fix Timer Restarting Every Second

#### [MODIFY] `src/Timer.jsx`

Same pattern — store `onExpire` in a ref:

```diff
-import { useEffect, useMemo, useState } from 'react'
+import { useEffect, useMemo, useRef, useState } from 'react'

 export default function Timer({ minutes, running, onStart, onExpire, resetKey }) {
+  const onExpireRef = useRef(onExpire)
+  onExpireRef.current = onExpire
   const totalSeconds = Math.max(0, Math.round((minutes || 0) * 60))
   const [remainingSeconds, setRemainingSeconds] = useState(totalSeconds)

   useEffect(() => {
     if (!running || remainingSeconds <= 0) return undefined
     const intervalId = window.setInterval(() => {
       setRemainingSeconds((prev) => {
         if (prev <= 1) {
           window.clearInterval(intervalId)
-          onExpire?.()
+          onExpireRef.current?.()
           return 0
         }
         return prev - 1
       })
     }, 1000)
     return () => window.clearInterval(intervalId)
-  }, [onExpire, remainingSeconds, running])
+  }, [running])
```

> IMPORTANT: The `remainingSeconds` was also in the deps, which restarted the interval every second. Removing it is correct because the interval manages its own countdown via the setter callback.

### 1.3 Fix ExerciseList Crash on Missing Topics

#### [MODIFY] `src/ExerciseList.jsx`

Two locations need guarding:

```diff
 // Line 150
-<span>{exercise.topics.slice(0, 2).join(', ')}</span>
+<span>{(exercise.topics || []).slice(0, 2).join(', ')}</span>

 // Line 172
-{exercise.topics.map((topic) => (
+{(exercise.topics || []).map((topic) => (
```

---

## Phase 2 — Security Fixes

### 2.1 Lock Down Firestore Write Fields

#### [MODIFY] `firestore.rules`

Replace the `codeDojo_users` rule:

```diff
 match /codeDojo_users/{uid} {
-  allow read, write: if request.auth != null && request.auth.uid == uid;
+  allow read: if request.auth != null && request.auth.uid == uid;
+  allow create: if request.auth != null && request.auth.uid == uid;
+  allow update: if request.auth != null && request.auth.uid == uid
+    && request.resource.data.diff(resource.data).affectedKeys()
+       .hasOnly(['displayName', 'theme', 'bookmarks', 'hasApiKey', 'keyUpdatedAt']);
   allow read: if isAdmin();
 }
```

### 2.2 Make API Key Secrets Write-Only

#### [MODIFY] `firestore.rules`

```diff
 match /codeDojo_users/{uid}/secrets/{doc} {
-  allow read, write: if request.auth != null && request.auth.uid == uid;
+  allow write: if request.auth != null && request.auth.uid == uid;
+  allow read: if false;
 }
```

> Only the Vercel API route (using Admin SDK) reads the key. The client never needs to.

### 2.3 Sanitize Error Messages in API

#### [MODIFY] `api/evaluate.js`

```diff
   } catch (error) {
     console.error('Evaluate error:', error)
-    return response.status(500).json({ error: error.message || 'Internal server error' })
+    return response.status(500).json({ error: 'Internal server error' })
   }
```

### 2.4 Add Input Validation to API

#### [MODIFY] `api/evaluate.js`

Add after the auth check (after line 49):

```javascript
const {
  exerciseId,
  exerciseTitle,
  exerciseDescription,
  testCases,
  code,
  hintUsed,
  baseXp,
  timeSpent,
} = request.body

if (!exerciseId || typeof exerciseId !== 'string') {
  return response.status(400).json({ error: 'Missing exerciseId.' })
}
if (typeof code !== 'string' || code.length > 50000) {
  return response.status(400).json({ error: 'Invalid or too-long code submission.' })
}
if (typeof baseXp !== 'number' || baseXp < 0 || baseXp > 500) {
  return response.status(400).json({ error: 'Invalid baseXp value.' })
}
```

### 2.5 Atomize Rate Limit Check

#### [MODIFY] `api/evaluate.js`

Replace the rate limit block (lines 51-69) with a transaction:

```javascript
const today = new Date().toISOString().slice(0, 10)
const rateLimitRef = db.doc(`codeDojo_rateLimit/${uid}`)

await db.runTransaction(async (t) => {
  const snap = await t.get(rateLimitRef)
  const data = snap.exists ? snap.data() : { submissionsToday: 0, lastReset: '' }
  if (data.lastReset === today && data.submissionsToday >= 50) {
    throw new Error('Daily limit reached (50/day). Try again tomorrow.')
  }
  const next = data.lastReset === today ? data.submissionsToday + 1 : 1
  t.set(rateLimitRef, { submissionsToday: next, lastReset: today })
})
```

### 2.6 Normalize Auth Error Messages

#### [MODIFY] `src/AuthModal.jsx`

```diff
     } catch (submitError) {
-      setError(submitError.message || 'Authentication failed.')
+      setError('Invalid email or password. Please try again.')
     }
```

---

## Phase 3 — Accessibility Fixes

### 3.1 Add Focus Trap, Escape Key, and ARIA to Modals

#### [MODIFY] `src/ModalShell.jsx`

Replace the entire file:

```jsx
import { useEffect, useRef } from 'react'

export default function ModalShell({ className, onClose, children }) {
  const shellRef = useRef(null)

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', handleKeyDown)

    // Trap focus inside modal
    const shell = shellRef.current
    const focusable = shell?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )
    if (focusable?.length) focusable[0].focus()

    // Prevent body scroll
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div
      className="modal-shell"
      role="dialog"
      aria-modal="true"
      ref={shellRef}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.()
      }}
    >
      <section className={`${className} modal-card`} onMouseDown={(e) => e.stopPropagation()}>
        {children}
      </section>
    </div>
  )
}
```

### 3.2 Add aria-live to Error Messages

#### [MODIFY] `src/AuthModal.jsx`, `src/ApiKeySetup.jsx`, `src/ExerciseManager.jsx`, `src/AdminDashboard.jsx`

In each file, find error message elements and add:

```diff
-{error && <p className="message error">{error}</p>}
+{error && <p className="message error" role="alert" aria-live="assertive">{error}</p>}
```

### 3.3 Add prefers-reduced-motion

#### [MODIFY] `src/styles.css`

Add at the bottom:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### 3.4 Add Table Accessibility

#### [MODIFY] `src/Leaderboard.jsx` and `src/AdminDashboard.jsx`

```diff
 <table>
+  <caption className="sr-only">Leaderboard rankings by XP</caption>
   <thead>
     <tr>
-      <th>Rank</th>
-      <th>Player</th>
+      <th scope="col">Rank</th>
+      <th scope="col">Player</th>
```

Add a `.sr-only` class to `styles.css`:

```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}
```

---

## Phase 4 — Error Handling & Resilience

### 4.1 Add ErrorBoundary

#### [NEW] `src/ErrorBoundary.jsx`

```jsx
import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="screen-center">
          <section className="panel loading-panel">
            <span className="eyebrow">Code Dojo</span>
            <h1>Something went wrong</h1>
            <p>{this.state.error?.message || 'An unexpected error occurred.'}</p>
            <button
              className="btn-primary"
              onClick={() => window.location.reload()}
              style={{ marginTop: 16 }}
            >
              Reload App
            </button>
          </section>
        </div>
      )
    }
    return this.props.children
  }
}
```

#### [MODIFY] `src/main.jsx`

Wrap App with ErrorBoundary:

```diff
+import ErrorBoundary from './ErrorBoundary'

 createRoot(document.getElementById('root')).render(
   <StrictMode>
     <ThemeProvider>
       <AuthProvider>
+        <ErrorBoundary>
           <App />
+        </ErrorBoundary>
       </AuthProvider>
     </ThemeProvider>
   </StrictMode>
 )
```

### 4.2 Fix Silent Error Swallowing in AdminDashboard

#### [MODIFY] `src/AdminDashboard.jsx`

```diff
   useEffect(() => {
-    loadDashboard().catch(() => {
-      setProfiles([])
-      setSubmissions([])
+    loadDashboard().catch((err) => {
+      console.error('Admin dashboard load failed:', err)
+      setError(err.message || 'Failed to load dashboard data. Check Firestore indexes.')
     })
   }, [])
```

### 4.3 Guard Batch Import Size

#### [MODIFY] `src/exercises.js`

```diff
 export async function importExercises(exercises) {
-  const batch = writeBatch(db)
-  exercises.forEach((exercise) => {
-    batch.set(doc(db, 'codeDojo_exercises', exercise.id), exercise)
-  })
-  await batch.commit()
+  const BATCH_SIZE = 500
+  for (let i = 0; i < exercises.length; i += BATCH_SIZE) {
+    const batch = writeBatch(db)
+    exercises.slice(i, i + BATCH_SIZE).forEach((exercise) => {
+      batch.set(doc(db, 'codeDojo_exercises', exercise.id), exercise)
+    })
+    await batch.commit()
+  }
 }
```

---

## Phase 5 — Performance Fixes

### 5.1 Limit Admin Submissions Query

#### [MODIFY] `src/AdminDashboard.jsx`

```diff
-import { collection, collectionGroup, getDocs, orderBy, query } from 'firebase/firestore'
+import { collection, collectionGroup, getDocs, limit, orderBy, query } from 'firebase/firestore'

-      getDocs(query(collectionGroup(db, 'submissions'), orderBy('submittedAt', 'desc'))),
+      getDocs(query(collectionGroup(db, 'submissions'), orderBy('submittedAt', 'desc'), limit(500))),
```

---

## Phase 6 — DRY / Clean Code

### 6.1 Extract Shared LEVELS

#### [NEW] `lib/levels.js`

Move the LEVELS array to a shared location importable by both frontend and API:

```javascript
export const LEVELS = [
  { name: 'White Belt', xpRequired: 0 },
  { name: 'Yellow Belt', xpRequired: 120 },
  { name: 'Orange Belt', xpRequired: 260 },
  { name: 'Green Belt', xpRequired: 430 },
  { name: 'Blue Belt', xpRequired: 620 },
  { name: 'Purple Belt', xpRequired: 840 },
  { name: 'Brown Belt', xpRequired: 1090 },
  { name: 'Red Belt', xpRequired: 1370 },
  { name: 'Black Belt', xpRequired: 1680 },
  { name: 'Master Sensei', xpRequired: 2020 },
]

export function getLevelFromXp(totalXp) {
  let index = 0
  for (let i = 0; i < LEVELS.length; i += 1) {
    if (totalXp >= LEVELS[i].xpRequired) index = i
  }
  return { index, name: LEVELS[index].name }
}
```

- `src/levels.js` imports from `../lib/levels.js` and adds the frontend-specific fields (`emoji`, `color`, `getLevelMeta`)
- `api/evaluate.js` imports `getLevelFromXp` from `../lib/levels.js` and deletes its local copy

### 6.2 Extract Shared formatDate Utility

#### [NEW] `src/utils.js`

```javascript
export function formatFirestoreDate(value) {
  if (!value) return 'Pending'
  if (typeof value.toDate === 'function') return value.toDate().toLocaleString()
  return new Date(value).toLocaleString()
}
```

- Delete `formatDate` from `AdminDashboard.jsx`
- Delete `formatSubmissionDate` from `UserProfile.jsx`
- Import `formatFirestoreDate` in both

---

## Phase 7 — UI Polish

### 7.1 Default to Dark Theme

#### [MODIFY] `src/ThemeContext.jsx`

Change the default theme:

```diff
-const stored = localStorage.getItem('codeDojo_theme') || 'light'
+const stored = localStorage.getItem('codeDojo_theme') || 'dark'
```

### 7.2 Add XP Sparkle Effect

#### [MODIFY] `src/styles.css`

```css
.today-xp {
  color: var(--xp-color);
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
  text-shadow: 0 0 8px rgba(242, 188, 88, 0.4);
  animation: sparkle 2s ease-in-out infinite;
}

@keyframes sparkle {
  0%,
  100% {
    text-shadow: 0 0 8px rgba(242, 188, 88, 0.4);
  }
  50% {
    text-shadow:
      0 0 16px rgba(242, 188, 88, 0.7),
      0 0 32px rgba(242, 188, 88, 0.3);
  }
}
```

---

## Verification Plan

### Automated

1. `npm run build` — no compilation errors
2. `npm run dev` — app loads without console errors
3. Deploy Firestore rules: `firebase deploy --only firestore:rules`

### Manual Browser Tests

1. **CodeEditor**: Type in the editor — cursor should NOT jump
2. **Timer**: Start timer — should count down smoothly without restarts
3. **ExerciseList**: Import exercises without `topics` field — should not crash
4. **Modals**: Press Escape to close any modal
5. **Dark theme**: App should load in dark mode by default
6. **Security**: Open DevTools, try `setDoc(doc(db, 'codeDojo_users/uid'), {totalXp: 99999})` — should be rejected
7. **Auth errors**: Wrong password should show generic message, not "wrong password"

---

## File Summary

| Action | File                      | Phase         |
| ------ | ------------------------- | ------------- |
| MODIFY | `src/CodeEditor.jsx`      | 1.1           |
| MODIFY | `src/Timer.jsx`           | 1.2           |
| MODIFY | `src/ExerciseList.jsx`    | 1.3           |
| MODIFY | `firestore.rules`         | 2.1, 2.2      |
| MODIFY | `api/evaluate.js`         | 2.3, 2.4, 2.5 |
| MODIFY | `src/AuthModal.jsx`       | 2.6, 3.2      |
| MODIFY | `src/ModalShell.jsx`      | 3.1           |
| MODIFY | `src/styles.css`          | 3.3, 3.4, 7.2 |
| MODIFY | `src/Leaderboard.jsx`     | 3.4           |
| MODIFY | `src/AdminDashboard.jsx`  | 3.4, 4.2, 5.1 |
| NEW    | `src/ErrorBoundary.jsx`   | 4.1           |
| MODIFY | `src/main.jsx`            | 4.1           |
| MODIFY | `src/exercises.js`        | 4.3           |
| NEW    | `lib/levels.js`           | 6.1           |
| MODIFY | `src/levels.js`           | 6.1           |
| NEW    | `src/utils.js`            | 6.2           |
| MODIFY | `src/UserProfile.jsx`     | 6.2           |
| MODIFY | `src/ThemeContext.jsx`    | 7.1           |
| MODIFY | `src/ApiKeySetup.jsx`     | 3.2           |
| MODIFY | `src/ExerciseManager.jsx` | 3.2           |

**Total: 16 modified files, 3 new files**
