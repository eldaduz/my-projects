// ╔══════════════════════════════════════════════════════════════════╗
// ║ SESSION MANAGEMENT — JWT tokens stored in httpOnly cookies      ║
// ║                                                                  ║
// ║ WHY COOKIES INSTEAD OF LOCALSTORAGE?                            ║
// ║   - httpOnly: JavaScript can't read the token (XSS protection)  ║
// ║   - sameSite: 'lax' prevents CSRF attacks                       ║
// ║   - secure: true (production) enforces HTTPS-only               ║
// ║                                                                  ║
// ║ REUSE: signSessionToken is used in auth.controller (login),     ║
// ║ setSessionCookie is used in auth.controller (login response),   ║
// ║ verifySessionToken is used in requireAuth middleware,            ║
// ║ clearSessionCookie is used in auth.controller (logout).         ║
// ║                                                                  ║
// ║ TEACHER Q: "What is a JWT?" → A signed JSON payload containing  ║
// ║ { sub: userId }. The server signs it with a secret key. On each ║
// ║ request, the server verifies the signature hasn't been tampered. ║
// ╚══════════════════════════════════════════════════════════════════╝
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';

export const SESSION_COOKIE_NAME = 'session_token';
const SESSION_LIFETIME_MS = 24 * 60 * 60 * 1000;

export function signSessionToken(userId) {
  return jwt.sign({ sub: userId.toString() }, env.jwtSecret, { expiresIn: '24h' });
}

export function verifySessionToken(token) {
  return jwt.verify(token, env.jwtSecret);
}

export function setSessionCookie(res, token) {
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'lax',
    maxAge: SESSION_LIFETIME_MS,
    path: '/',
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/',
  });
}
