import 'dotenv/config';

const REQUIRED_VARS = ['MONGODB_URI', 'JWT_SECRET'];
// Only load-bearing once deployed — see requireProxySecret.js (ATP-85). Required
// in production so a missing/misconfigured secret fails startup loudly instead
// of silently locking out every real Vercel-proxied request.
const PRODUCTION_REQUIRED_VARS = ['INTERNAL_PROXY_SECRET'];

function readEnv() {
  const required =
    process.env.NODE_ENV === 'production' ? [...REQUIRED_VARS, ...PRODUCTION_REQUIRED_VARS] : REQUIRED_VARS;
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variable(s): ${missing.join(', ')}`);
  }

  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: Number(process.env.PORT) || 5000,
    mongoUri: process.env.MONGODB_URI,
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    jwtSecret: process.env.JWT_SECRET,
    // ATP-85: shared secret Vercel Edge Middleware attaches to rewritten /api
    // requests, so this server can tell a genuine Vercel-proxied request apart
    // from a direct hit to Render's own public URL (which would otherwise be
    // one X-Forwarded-For hop short of trust-proxy's assumption, letting an
    // attacker forge req.ip and evade per-IP rate limiting).
    internalProxySecret: process.env.INTERNAL_PROXY_SECRET,
    // Gemini is backend-only; the adapter validates the key when a live client is created.
    geminiApiKey: process.env.GEMINI_API_KEY,
    geminiModel: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
    // E2E-only escape hatch: swaps the real Gemini adapter for a deterministic
    // fake one. Hard-gated on NODE_ENV !== 'production' so this can never be
    // flipped on in a deployed environment by an accidental env var.
    aiAdapterMode:
      process.env.NODE_ENV !== 'production' && process.env.AI_ADAPTER_MODE === 'fake' ? 'fake' : 'real',
    jsonBodyLimit: process.env.JSON_BODY_LIMIT || '100kb',
    // Baseline per SYSTEM_DESIGN §7: 10 requests / 15 minutes / IP on auth endpoints.
    authRateLimitMax: Number(process.env.AUTH_RATE_LIMIT_MAX) || 10,
    authRateLimitWindowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    // Baseline per SYSTEM_DESIGN §7 / ATP-70: 5 requests / 5 minutes / user on
    // AI (Gemini-backed) endpoints, plus a looser per-IP ceiling.
    aiRateLimitMax: Number(process.env.AI_RATE_LIMIT_MAX) || 5,
    aiRateLimitWindowMs: Number(process.env.AI_RATE_LIMIT_WINDOW_MS) || 5 * 60 * 1000,
    aiRateLimitIpMax: Number(process.env.AI_RATE_LIMIT_IP_MAX) || 20,
    // ATP-71: a GENERATING/REPLANNING trip older than this recovers on next read.
    aiStaleOperationMs: Number(process.env.AI_STALE_OPERATION_MS) || 2 * 60 * 1000,
  };
}

export const env = readEnv();
