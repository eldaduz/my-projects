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
