import { env } from '../config/env.js';
import { HttpError } from './errorHandler.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Extra CSRF defense alongside SameSite=Lax cookies (SYSTEM_DESIGN §7): browsers
// always attach an Origin header on cross-origin state-changing requests, so a
// present-but-mismatched Origin is rejected. A request with no Origin header at
// all (same-origin navigation, non-browser API clients) is allowed through —
// CSRF requires a browser-driven cross-origin request, which always sets Origin.
export function requireExpectedOrigin(req, res, next) {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  const origin = req.get('origin');
  if (origin && origin !== env.corsOrigin) {
    return next(new HttpError(403, 'Request origin is not allowed.', 'INVALID_ORIGIN'));
  }

  next();
}
