// ╔══════════════════════════════════════════════════════════════════╗
// ║ AUTH CONTROLLER — Register, Login, Logout, Get Current User      ║
// ║                                                                  ║
// ║ KEY CONCEPTS:                                                    ║
// ║   - bcrypt: hashes passwords (12 salt rounds = intentionally     ║
// ║     slow to prevent brute-force attacks)                         ║
// ║   - DUMMY_HASH: timing attack prevention (see below)             ║
// ║   - JWT cookie: session token stored in httpOnly cookie          ║
// ║     (not localStorage) for XSS protection                       ║
// ║                                                                  ║
// ║ REUSE: HttpError from errorHandler.js (shared across ALL modules)║
// ║ REUSE: session.js functions used here and in requireAuth.js      ║
// ╚══════════════════════════════════════════════════════════════════╝
import bcrypt from 'bcrypt';
import { User } from './user.model.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { signSessionToken, setSessionCookie, clearSessionCookie } from './session.js';

// STUDY NOTE: 12 salt rounds makes hashing intentionally slow (~250ms).
// This is a FEATURE, not a bug — it makes brute-force attacks impractical.
const SALT_ROUNDS = 12;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254; // RFC 5321
const MIN_PASSWORD_LENGTH = 8;
// STUDY NOTE: bcrypt silently truncates passwords beyond 72 characters.
// We reject them explicitly so the user knows their full password matters.
const MAX_PASSWORD_LENGTH = 72; // bcrypt silently truncates beyond this

// STUDY NOTE: TIMING ATTACK PREVENTION.
// When a user tries to login with a non-existent email, we STILL run
// bcrypt.compare against this dummy hash. Why? Without it, "email not found"
// returns instantly, but "wrong password" takes ~250ms (bcrypt is slow).
// An attacker could measure response times to discover which emails exist.
// By always running bcrypt.compare, both cases take the same time.
// TEACHER Q: "What is a timing attack?" → An attack that uses response
// time differences to leak information about the system's state.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', SALT_ROUNDS);

export async function registerUser(req, res, next) {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) {
      throw new HttpError(400, 'A valid email address is required.', 'INVALID_EMAIL');
    }
    if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
      throw new HttpError(
        400,
        `Password must be between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters.`,
        'INVALID_PASSWORD',
      );
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await User.create({ email, passwordHash });

    res.status(201).json({ user });
  } catch (err) {
    // Unique index is the authoritative duplicate-email guard; catching E11000
    // here covers the case where two requests race past validation together.
    if (err.code === 11000) {
      return next(new HttpError(409, 'An account with this email already exists.', 'EMAIL_TAKEN'));
    }
    next(err);
  }
}

export async function loginUser(req, res, next) {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    const user = await User.findOne({ email }).select('+passwordHash');
    const passwordMatches = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);

    if (!user || !passwordMatches) {
      throw new HttpError(401, 'Invalid email or password.', 'INVALID_CREDENTIALS');
    }

    setSessionCookie(res, signSessionToken(user._id));

    res.status(200).json({ user });
  } catch (err) {
    next(err);
  }
}

// Auth validation itself lives in requireAuth (ATP-32); this route only
// shapes the response once that middleware has attached req.user.
export function getCurrentUser(req, res) {
  res.status(200).json({ user: req.user });
}

export function logoutUser(req, res) {
  clearSessionCookie(res);
  res.status(204).end();
}
