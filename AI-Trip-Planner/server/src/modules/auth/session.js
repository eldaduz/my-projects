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
