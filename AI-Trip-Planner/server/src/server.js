// ╔══════════════════════════════════════════════════════════════════╗
// ║ SERVER ENTRY POINT                                              ║
// ║ This is where the application starts. It:                       ║
// ║   1. Connects to MongoDB                                        ║
// ║   2. Creates the Express app (via factory pattern — see app.js) ║
// ║   3. Starts listening for HTTP requests on a port               ║
// ║                                                                  ║
// ║ PATTERN: Factory function (createApp) — we don't hardcode the   ║
// ║ Gemini adapter; we pass it in so tests can swap in a fake one.  ║
// ║ This is called DEPENDENCY INJECTION.                            ║
// ╚══════════════════════════════════════════════════════════════════╝
import { env } from './config/env.js'
import { connectDB } from './config/db.js'
import { createApp } from './app.js'
import { createFakeGeminiAdapter } from './modules/ai/fakeGeminiAdapter.js'
import { buildFakeItineraryResponse } from './modules/ai/e2eFakeItineraryResponse.js'

// STUDY NOTE: This function decides which Gemini adapter to use.
// In dev/test, you can set AI_ADAPTER_MODE=fake to avoid real AI API calls.
// In production, this is hard-blocked — it always uses the real adapter.
// WHY? E2E tests need deterministic (predictable) AI responses, but you
// never want fake data in production. This is a SAFETY GATE pattern.
//
// REUSE: buildFakeItineraryResponse is used for ALL three adapter methods
// (generate, correction, replan) — one function serves three purposes.
function buildGeminiAdapter() {
  if (env.aiAdapterMode === 'fake') {
    console.warn('AI_ADAPTER_MODE=fake: using the deterministic fake Gemini adapter. Never do this in production.')
    return createFakeGeminiAdapter({
      generateResponse: buildFakeItineraryResponse,
      correctionResponse: buildFakeItineraryResponse,
      replanResponse: buildFakeItineraryResponse,
    })
  }

  if (process.env.AI_ADAPTER_MODE === 'fake') {
    console.warn('AI_ADAPTER_MODE=fake was requested but ignored because NODE_ENV=production — using the real Gemini adapter.')
  }

  return undefined
}

// STUDY NOTE: main() is async because connectDB() is async (returns a Promise).
// The app is created with createApp() — a factory that receives its dependencies.
// If buildGeminiAdapter() returns undefined, createApp will create a real one.
async function main() {
  await connectDB()

  const app = createApp({ geminiAdapter: buildGeminiAdapter() })
  app.listen(env.port, () => {
    console.log(`Server listening on port ${env.port}`)
  })
}

main().catch((err) => {
  console.error('Failed to start server:', err.message)
  process.exit(1)
})
