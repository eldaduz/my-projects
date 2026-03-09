# Vercel Migration — Replace Firebase Cloud Function with Vercel API Route

> **Context:** Firebase Cloud Functions require the Blaze (paid) plan. We are on Spark (free).
> This migration moves the `evaluateCode` function to a Vercel Serverless Function.
> Everything else (Auth, Firestore, security rules, all frontend components) stays exactly the same.

---

## Step 1: Install Firebase Admin SDK at project root

```bash
npm install firebase-admin
```

## Step 2: Create Vercel API Route

### Create `api/evaluate.js`

This is the **exact same logic** as `functions/index.js`, but wrapped as a Vercel serverless function instead of a Firebase callable.

````javascript
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'

// Initialize Firebase Admin (only once)
if (!getApps().length) {
  // Use service account credentials from environment variable
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  initializeApp({ credential: cert(serviceAccount) })
}

const db = getFirestore()

const GEMINI_ENDPOINT = (apiKey) =>
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`

const LEVELS = [
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

function normalizeScore(score) {
  if (!Number.isFinite(score)) return 65
  if (score <= 10) return Math.round(score * 10)
  return Math.round(Math.max(0, Math.min(100, score)))
}

function getLevelFromXp(totalXp) {
  let index = 0
  for (let i = 0; i < LEVELS.length; i++) {
    if (totalXp >= LEVELS[i].xpRequired) index = i
  }
  return { index, name: LEVELS[index].name }
}

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // 1. Verify Firebase Auth token from the Authorization header
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Must be logged in.' })
    }

    const idToken = authHeader.split('Bearer ')[1]
    const decodedToken = await getAuth().verifyIdToken(idToken)
    const uid = decodedToken.uid

    // 2. Rate limit check
    const today = new Date().toISOString().slice(0, 10)
    const rateLimitRef = db.doc(`codeDojo_rateLimit/${uid}`)
    const rateLimitSnap = await rateLimitRef.get()

    if (rateLimitSnap.exists) {
      const rlData = rateLimitSnap.data()
      if (rlData.lastReset === today && rlData.submissionsToday >= 50) {
        return res.status(429).json({ error: 'Daily limit reached (50/day). Try again tomorrow.' })
      }
      if (rlData.lastReset !== today) {
        await rateLimitRef.set({ submissionsToday: 1, lastReset: today })
      } else {
        await rateLimitRef.update({ submissionsToday: FieldValue.increment(1) })
      }
    } else {
      await rateLimitRef.set({ submissionsToday: 1, lastReset: today })
    }

    // 3. Read user's Gemini API key from Firestore
    const secretSnap = await db.doc(`codeDojo_users/${uid}/secrets/apiKey`).get()
    if (!secretSnap.exists || !secretSnap.data()?.key) {
      return res
        .status(400)
        .json({ error: 'No API key saved. Add your Gemini API key in settings.' })
    }
    const apiKey = secretSnap.data().key

    // 4. Call Gemini API
    const {
      exerciseId,
      exerciseTitle,
      exerciseDescription,
      testCases,
      code,
      hintUsed,
      baseXp,
      timeSpent,
    } = req.body

    const prompt = `Act as a concise JavaScript code reviewer. Task: ${exerciseTitle} - ${exerciseDescription}. Test cases: ${JSON.stringify(testCases || [])}. Code: ${code}. Return strictly a JSON object with keys "score" and "feedback". Score must be an integer between 0 and 100. feedback should be readable Markdown with short sections and bullet points.`

    const geminiRes = await fetch(GEMINI_ENDPOINT(apiKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    })

    if (!geminiRes.ok) {
      const errText = await geminiRes.text()
      if (errText.includes('API_KEY_INVALID') || errText.includes('API key not valid')) {
        return res
          .status(403)
          .json({ error: 'Your Gemini API key is invalid. Please update it in settings.' })
      }
      return res.status(500).json({ error: 'Gemini API request failed.' })
    }

    const data = await geminiRes.json()
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
    const feedback = String(parsed.feedback || 'No feedback received.')
      .replace(/^```markdown\n?|\n?```$/g, '')
      .trim()

    // 5. Calculate XP
    const profileRef = db.doc(`codeDojo_users/${uid}`)
    const profileSnap = await profileRef.get()
    const profile = profileSnap.exists ? profileSnap.data() : {}
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().slice(0, 10)
    const currentStreak = profile.streak || 0
    const nextStreak =
      profile.lastPracticeDate === yesterdayStr
        ? currentStreak + 1
        : profile.lastPracticeDate === today
          ? currentStreak
          : 1

    const streakMultiplier = nextStreak >= 7 ? 1.1 : 1
    const hintMultiplier = hintUsed ? 0.65 : 1
    const xpEarned = Math.round((baseXp || 120) * (score / 100) * hintMultiplier * streakMultiplier)
    const totalXp = (profile.totalXp || 0) + xpEarned
    const level = getLevelFromXp(totalXp)

    // 6. Save submission
    await db.collection(`codeDojo_users/${uid}/submissions`).add({
      exerciseId,
      exerciseTitle,
      code,
      score,
      feedback,
      xpEarned,
      hintUsed: Boolean(hintUsed),
      timeSpent: timeSpent || null,
      submittedAt: FieldValue.serverTimestamp(),
    })

    // 7. Update user profile
    await profileRef.set(
      {
        totalXp,
        level: level.index + 1,
        levelName: level.name,
        streak: nextStreak,
        lastPracticeDate: today,
      },
      { merge: true },
    )

    // 8. Update exercise stats
    const exerciseUpdate = { attemptCount: FieldValue.increment(1) }
    if (score >= 60) exerciseUpdate.solvedCount = FieldValue.increment(1)
    await db.doc(`codeDojo_exercises/${exerciseId}`).set(exerciseUpdate, { merge: true })

    // 9. Update leaderboard
    await db.doc(`codeDojo_leaderboard/${uid}`).set(
      {
        displayName: profile.displayName || decodedToken.email || 'Anonymous',
        totalXp,
        level: level.index + 1,
        levelName: level.name,
        streak: nextStreak,
      },
      { merge: true },
    )

    return res.status(200).json({ score, feedback, xpEarned })
  } catch (err) {
    console.error('Evaluate error:', err)
    return res.status(500).json({ error: err.message || 'Internal server error' })
  }
}
````

## Step 3: Modify `src/App.jsx`

Make these changes:

### 3a. Remove the Firebase Functions import (line 4)

```diff
-import { httpsCallable } from 'firebase/functions'
+import { getIdToken } from 'firebase/auth'
```

### 3b. Remove `functions` from the firebase import (line 7)

```diff
-import { db, functions } from './firebase'
+import { db, auth } from './firebase'
```

### 3c. Remove the `evaluateCodeFn` line (line 99)

```diff
-  const evaluateCodeFn = httpsCallable(functions, 'evaluateCode')
```

### 3d. Replace the `handleSubmit` function body (around line 215-246)

Replace the `evaluateCodeFn(...)` call with a `fetch('/api/evaluate', ...)` call:

```javascript
const handleSubmit = async () => {
  if (!currentExercise || !user) return

  setSubmitting(true)
  try {
    const token = await getIdToken(auth.currentUser)
    const response = await fetch('/api/evaluate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        exerciseId: currentExercise.id,
        exerciseTitle: currentExercise.title,
        exerciseDescription: currentExercise.description,
        testCases: currentExercise.testCases || [],
        code,
        hintUsed,
        baseXp: currentExercise.baseXp,
        timeSpent: attemptStartedAt ? Math.round((Date.now() - attemptStartedAt) / 1000) : null,
      }),
    })

    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Evaluation failed')

    setScore(result.score)
    setFeedback(result.feedback)
    setEarnedXp(result.xpEarned)
    setShowSolution(result.score < 50)
    setTimerRunning(false)

    await Promise.all([refreshSubmissions(), refreshProfile(), refreshExercises()])
  } catch (submitError) {
    setScore(0)
    setFeedback(getSubmissionErrorMessage(submitError))
    setEarnedXp(0)
    setShowSolution(true)
  } finally {
    setSubmitting(false)
  }
}
```

## Step 4: Export `auth` from `src/firebase.js`

Make sure `auth` is exported (it likely already is). Verify:

```javascript
export const auth = getAuth(app)
```

Also, the `functions` export and `getFunctions` import can be removed from `firebase.js` since we no longer use Cloud Functions.

## Step 5: Set Up Vercel Environment Variable

The Vercel API route needs Firebase Admin credentials. Generate a service account key:

1. Go to Firebase Console → ⚙️ Project Settings → **Service accounts** tab
2. Click **"Generate new private key"** → downloads a `.json` file
3. Go to Vercel Dashboard → your Code Dojo project → **Settings** → **Environment Variables**
4. Add variable:
   - Name: `FIREBASE_SERVICE_ACCOUNT`
   - Value: paste the ENTIRE contents of the downloaded `.json` file
   - Environment: Production, Preview, Development

> **IMPORTANT:** Never commit the service account JSON file to git. Add it to `.gitignore`.

## Step 6: Configure Vercel for API Routes

### Create or update `vercel.json` in project root:

```json
{
  "rewrites": [{ "source": "/api/:path*", "destination": "/api/:path*" }]
}
```

## Step 7: Clean Up (Optional)

The `functions/` directory is no longer needed for production. You can keep it for a future Blaze upgrade, or delete it:

- `functions/index.js` — the old Cloud Function (keep as backup or delete)
- `functions/package.json` — its dependencies
- `functions/node_modules/` — its modules

You can also remove `getFunctions` and `connectFunctionsEmulator` from `src/firebase.js`.

---

## Summary of Changes

| File              | Action                                                             |
| ----------------- | ------------------------------------------------------------------ |
| `api/evaluate.js` | **NEW** — Vercel serverless function                               |
| `src/App.jsx`     | **MODIFY** — Replace `httpsCallable` with `fetch('/api/evaluate')` |
| `src/firebase.js` | **MODIFY** — Remove `functions` export, keep `auth` export         |
| `vercel.json`     | **NEW** — API route rewrite config                                 |
| `package.json`    | **MODIFY** — Add `firebase-admin` dependency                       |
| Vercel Dashboard  | **CONFIGURE** — Add `FIREBASE_SERVICE_ACCOUNT` env var             |

Everything else (Auth, Firestore, UI, components, security rules) stays unchanged.
