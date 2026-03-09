import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

if (!getApps().length) {
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
  for (let i = 0; i < LEVELS.length; i += 1) {
    if (totalXp >= LEVELS[i].xpRequired) index = i
  }
  return { index, name: LEVELS[index].name }
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const authHeader = request.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return response.status(401).json({ error: 'Must be logged in.' })
    }

    const idToken = authHeader.split('Bearer ')[1]
    const decodedToken = await getAuth().verifyIdToken(idToken)
    const uid = decodedToken.uid

    const today = new Date().toISOString().slice(0, 10)
    const rateLimitRef = db.doc(`codeDojo_rateLimit/${uid}`)
    const rateLimitSnapshot = await rateLimitRef.get()

    if (rateLimitSnapshot.exists) {
      const rateLimitData = rateLimitSnapshot.data()
      if (rateLimitData.lastReset === today && rateLimitData.submissionsToday >= 50) {
        return response
          .status(429)
          .json({ error: 'Daily limit reached (50/day). Try again tomorrow.' })
      }
      if (rateLimitData.lastReset !== today) {
        await rateLimitRef.set({ submissionsToday: 1, lastReset: today })
      } else {
        await rateLimitRef.update({ submissionsToday: FieldValue.increment(1) })
      }
    } else {
      await rateLimitRef.set({ submissionsToday: 1, lastReset: today })
    }

    const secretSnapshot = await db.doc(`codeDojo_users/${uid}/secrets/apiKey`).get()
    if (!secretSnapshot.exists || !secretSnapshot.data()?.key) {
      return response
        .status(400)
        .json({ error: 'No API key saved. Add your Gemini API key in settings.' })
    }

    const apiKey = secretSnapshot.data().key
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

    const prompt = `Act as a concise JavaScript code reviewer. Task: ${exerciseTitle} - ${exerciseDescription}. Test cases: ${JSON.stringify(testCases || [])}. Code: ${code}. Return strictly a JSON object with keys "score" and "feedback". Score must be an integer between 0 and 100. feedback should be readable Markdown with short sections and bullet points.`

    const geminiResponse = await fetch(GEMINI_ENDPOINT(apiKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    })

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text()
      if (errorText.includes('API_KEY_INVALID') || errorText.includes('API key not valid')) {
        return response
          .status(403)
          .json({ error: 'Your Gemini API key is invalid. Please update it in settings.' })
      }
      return response.status(500).json({ error: 'Gemini API request failed.' })
    }

    const data = await geminiResponse.json()
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

    const profileRef = db.doc(`codeDojo_users/${uid}`)
    const profileSnapshot = await profileRef.get()
    const profile = profileSnapshot.exists ? profileSnapshot.data() : {}
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayString = yesterday.toISOString().slice(0, 10)
    const currentStreak = profile.streak || 0
    const nextStreak =
      profile.lastPracticeDate === yesterdayString
        ? currentStreak + 1
        : profile.lastPracticeDate === today
          ? currentStreak
          : 1

    const streakMultiplier = nextStreak >= 7 ? 1.1 : 1
    const hintMultiplier = hintUsed ? 0.65 : 1
    const xpEarned = Math.round((baseXp || 120) * (score / 100) * hintMultiplier * streakMultiplier)
    const totalXp = (profile.totalXp || 0) + xpEarned
    const level = getLevelFromXp(totalXp)

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

    const exerciseUpdate = { attemptCount: FieldValue.increment(1) }
    if (score >= 60) {
      exerciseUpdate.solvedCount = FieldValue.increment(1)
    }
    await db.doc(`codeDojo_exercises/${exerciseId}`).set(exerciseUpdate, { merge: true })

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

    return response.status(200).json({ score, feedback, xpEarned })
  } catch (error) {
    console.error('Evaluate error:', error)
    return response.status(500).json({ error: error.message || 'Internal server error' })
  }
}
