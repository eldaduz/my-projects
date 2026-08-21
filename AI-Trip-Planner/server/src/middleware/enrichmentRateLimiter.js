import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

const rateLimitHandler = (req, res) => {
  res.status(429).json({
    error: { message: 'Too many requests. Please try again shortly.', code: 'RATE_LIMITED' },
  });
};

// ATP-89: shared budget guard across autocomplete/weather/photo, sized for
// autocomplete's per-keystroke traffic. Defaults: 30 requests / 60s / IP.
export const enrichmentRateLimiter = rateLimit({
  windowMs: env.enrichmentRateLimitWindowMs,
  max: env.enrichmentRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

// ATP-89 (Codex review finding, round 2): Pexels' 200 req/hour quota is
// account-wide, not per-caller — a per-IP limiter still lets N distinct
// users each burn the full per-IP allowance and blow the shared budget
// together. keyGenerator pins every request to the same bucket so this is
// a genuine global cap across all callers, not per-IP. Default: 180
// requests / hour, total, leaving headroom under Pexels' 200/hour ceiling.
export const photoRateLimiter = rateLimit({
  windowMs: env.photoRateLimitWindowMs,
  max: env.photoRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: () => 'global',
  handler: rateLimitHandler,
});
