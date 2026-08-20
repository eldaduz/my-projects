import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

const RATE_LIMITED_RESPONSE = {
  error: { message: 'Too many AI requests. Please try again later.', code: 'AI_RATE_LIMITED' },
};

// Baseline abuse control for Gemini-backed endpoints (SYSTEM_DESIGN §7,
// ATP-70): 5 requests / 5 minutes / authenticated user (these routes always
// run after requireAuth, so req.user.id is present), plus a looser per-IP
// ceiling so one IP can't bypass the per-user limit with many accounts. Both
// windows/maxes are env-configurable, same pattern as authRateLimiter.js.
export const aiRateLimiter = rateLimit({
  windowMs: env.aiRateLimitWindowMs,
  max: env.aiRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user.id),
  handler: (req, res) => res.status(429).json(RATE_LIMITED_RESPONSE),
});

export const aiRateLimiterByIp = rateLimit({
  windowMs: env.aiRateLimitWindowMs,
  max: env.aiRateLimitIpMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json(RATE_LIMITED_RESPONSE),
});
