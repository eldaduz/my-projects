// ╔══════════════════════════════════════════════════════════════════╗
// ║ AUTH MIDDLEWARE — Protects all routes that need a logged-in user ║
// ║                                                                  ║
// ║ HOW IT WORKS:                                                    ║
// ║   1. Reads JWT token from the httpOnly cookie                   ║
// ║   2. Verifies the token signature (using verifySessionToken)    ║
// ║   3. Extracts userId from the token payload (sub field)         ║
// ║   4. Sets req.userId for downstream controllers to use          ║
// ║   5. If token is missing/invalid → throws 401 Unauthorized     ║
// ║                                                                  ║
// ║ REUSE: Used in EVERY protected route module:                    ║
// ║   - auth.routes.js (GET /me, POST /logout)                      ║
// ║   - travelers.routes.js (all CRUD routes)                       ║
// ║   - trips.routes.js (all CRUD + AI routes)                      ║
// ║   - enrichment.routes.js (autocomplete, weather, photo)         ║
// ╚══════════════════════════════════════════════════════════════════╝

import { User } from '../modules/auth/user.model.js';
import { HttpError } from './errorHandler.js';
import { verifySessionToken, SESSION_COOKIE_NAME } from '../modules/auth/session.js';

// Centralizes JWT-cookie validation so every protected route shares one
// consistent unauthenticated/expired/invalid behavior instead of re-checking
// the session cookie per route.
export async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.[SESSION_COOKIE_NAME];
    if (!token) {
      throw new HttpError(401, 'Not authenticated.', 'UNAUTHENTICATED');
    }

    let payload;
    try {
      payload = verifySessionToken(token);
    } catch {
      throw new HttpError(401, 'Session expired or invalid.', 'INVALID_SESSION');
    }

    const user = await User.findById(payload.sub).catch(() => null);
    if (!user) {
      throw new HttpError(401, 'Session expired or invalid.', 'INVALID_SESSION');
    }

    req.user = user;
    req.userId = user.id;
    next();
  } catch (err) {
    next(err);
  }
}
