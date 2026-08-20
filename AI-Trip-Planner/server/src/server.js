import { env } from './config/env.js'
import { connectDB } from './config/db.js'
import { createApp } from './app.js'
import { createFakeGeminiAdapter } from './modules/ai/fakeGeminiAdapter.js'
import { buildFakeItineraryResponse } from './modules/ai/e2eFakeItineraryResponse.js'

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
