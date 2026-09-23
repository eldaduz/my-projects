import { MongoMemoryServer } from 'mongodb-memory-server'

async function main() {
  const mongod = await MongoMemoryServer.create()

  process.env.MONGODB_URI = mongod.getUri('ai-trip-planner-e2e')
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'e2e-harness-secret-not-for-production'
  process.env.AI_ADAPTER_MODE = 'fake'
  process.env.NODE_ENV = process.env.NODE_ENV || 'development'
  process.env.PORT = process.env.PORT || '5000'
  process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173'
  process.env.AUTH_RATE_LIMIT_MAX = process.env.AUTH_RATE_LIMIT_MAX || '100'
  process.env.AI_RATE_LIMIT_MAX = process.env.AI_RATE_LIMIT_MAX || '100'
  process.env.AI_RATE_LIMIT_IP_MAX = process.env.AI_RATE_LIMIT_IP_MAX || '100'

  const shutdown = async () => {
    await mongod.stop()
    process.exit(0)
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)

  // Deferred import: server.js reads process.env at module-evaluation time
  // (via config/env.js's readEnv()), so the env vars above must be set before
  // this import runs, not before the script starts.
  await import('../src/server.js')
}

main().catch((err) => {
  console.error('Failed to start E2E server harness:', err)
  process.exit(1)
})
