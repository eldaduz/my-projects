import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

// Baseline abuse control for register/login (SYSTEM_DESIGN §7): configurable
// via AUTH_RATE_LIMIT_MAX / AUTH_RATE_LIMIT_WINDOW_MS, defaulting to
// 10 requests / 15 minutes / IP. Returns the project's standard error shape
// instead of express-rate-limit's default plain-text body.
export const authRateLimiter = rateLimit({
  windowMs: env.authRateLimitWindowMs,
  max: env.authRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: { message: 'Too many attempts. Please try again later.', code: 'RATE_LIMITED' },
    });
  },
});
