import { FieldValue } from 'firebase-admin/firestore'
import { getAdminServices } from './_firebaseAdmin.js'

const { adminAuth, adminDb: db } = getAdminServices()

const GEMINI_ENDPOINT = (apiKey) =>
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`

function normalizeList(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry || '').trim()).filter(Boolean)
  }

  if (typeof value === 'string' && value.trim()) {
    return value
      .split('\n')
      .map((entry) => entry.replace(/^[-*\d.\s]+/, '').trim())
      .filter(Boolean)
  }

  return []
}

function normalizeGuidedSolution(rawText) {
  let parsed

  try {
    parsed = JSON.parse(rawText.replace(/^```json\n?|\n?```$/g, ''))
  } catch {
    parsed = null
  }

  if (!parsed || typeof parsed !== 'object') {
    return {
      summary: 'Gemini returned a solution in an unexpected format. Review the generated explanation below.',
      steps: ['Read the explanation carefully and compare it with your current attempt.'],
      whyItWorks: rawText || 'No guided solution explanation was returned.',
      complexity: 'Time complexity and space complexity were not provided.',
      pitfalls: ['Double-check edge cases and ensure your implementation matches the prompt.'],
      solutionCode: '',
    }
  }

  return {
    summary: String(parsed.summary || 'Use this guided solution to understand the intended approach.').trim(),
    steps: normalizeList(parsed.steps),
    whyItWorks: String(parsed.whyItWorks || 'Why this works was not provided.').trim(),
    complexity: String(parsed.complexity || 'Complexity analysis was not provided.').trim(),
    pitfalls: normalizeList(parsed.pitfalls),
    solutionCode: String(parsed.solutionCode || '').trim(),
  }
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
    const decodedToken = await adminAuth.verifyIdToken(idToken)
    const uid = decodedToken.uid

    const today = new Date().toISOString().slice(0, 10)
    const rateLimitRef = db.doc(`codeDojo_guidedSolutionRateLimit/${uid}`)

    try {
      await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(rateLimitRef)
        const data = snapshot.exists ? snapshot.data() : { requestsToday: 0, lastReset: '' }
        if (data.lastReset === today && data.requestsToday >= 15) {
          throw new Error('RATE_LIMIT')
        }
        const nextCount = data.lastReset === today ? data.requestsToday + 1 : 1
        transaction.set(rateLimitRef, { requestsToday: nextCount, lastReset: today })
      })
    } catch (rateLimitError) {
      if (rateLimitError.message === 'RATE_LIMIT') {
        return response
          .status(429)
          .json({ error: 'Daily guided solution limit reached (15/day). Try again tomorrow.' })
      }
      throw rateLimitError
    }

    const secretSnapshot = await db.doc(`codeDojo_users/${uid}/secrets/apiKey`).get()
    if (!secretSnapshot.exists || !secretSnapshot.data()?.key) {
      return response
        .status(400)
        .json({ error: 'No API key saved. Add your Gemini API key in settings.' })
    }

    const {
      exerciseId,
      exerciseTitle,
      exerciseDescription,
      starterCode,
      testCases,
      hint,
      solutionApproach,
      code,
    } = request.body

    if (!exerciseId || typeof exerciseId !== 'string') {
      return response.status(400).json({ error: 'Missing exerciseId.' })
    }

    const prompt = `You are a JavaScript learning coach for Code Dojo. Generate a worked guided solution for this exercise.

Exercise title: ${exerciseTitle}
Exercise description: ${exerciseDescription}
Starter code:
${starterCode || ''}

User attempt:
${code || '(no user attempt yet)'}

Hint:
${hint || '(no built-in hint provided)'}

Stored solution approach:
${solutionApproach || '(no stored solution approach provided)'}

Test cases:
${JSON.stringify(testCases || [])}

Return strictly valid JSON with these keys only:
- summary: short paragraph
- steps: array of 3 to 6 concise strings explaining the solve path
- whyItWorks: paragraph
- complexity: short paragraph including time/space complexity
- pitfalls: array of 2 to 5 concise strings
- solutionCode: full JavaScript solution code

The explanation must teach the user how the problem is solved, not just provide the answer.`

    const geminiResponse = await fetch(GEMINI_ENDPOINT(secretSnapshot.data().key), {
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
    const guidedSolution = normalizeGuidedSolution(rawText)

    await db.collection(`codeDojo_users/${uid}/guidedSolutions`).add({
      exerciseId,
      exerciseTitle,
      codeSnapshot: String(code || ''),
      requestedAt: FieldValue.serverTimestamp(),
    })

    await db.doc(`codeDojo_exercises/${exerciseId}`).set(
      { attemptCount: FieldValue.increment(1) },
      { merge: true },
    )

    return response.status(200).json(guidedSolution)
  } catch (error) {
    console.error('Guided solution error:', error)
    return response.status(500).json({ error: 'Internal server error' })
  }
}
