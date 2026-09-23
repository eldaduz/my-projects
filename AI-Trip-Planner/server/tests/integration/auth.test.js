import { describe, test, expect, beforeAll, afterEach, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../../src/app.js';
import { User } from '../../src/modules/auth/user.model.js';
import { SESSION_COOKIE_NAME } from '../../src/modules/auth/session.js';
import { env } from '../../src/config/env.js';

let mongod;
let app;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  app = createApp();
});

afterEach(async () => {
  await User.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

async function registerUser(overrides = {}) {
  const email = overrides.email ?? 'login@example.com';
  const password = overrides.password ?? 'Sup3rSecret!';
  await request(app).post('/api/auth/register').send({ email, password });
  return { email, password };
}

async function loginAgent(overrides = {}) {
  const { email, password } = await registerUser(overrides);
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ email, password });
  return { agent, email };
}

describe('POST /api/auth/register', () => {
  test('creates a user with valid input and never returns the password/hash', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'traveler@example.com', password: 'Sup3rSecret!' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      user: {
        id: expect.any(String),
        email: 'traveler@example.com',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      },
    });
  });

  test('hashes the password with bcrypt, never storing it plaintext', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'hash@example.com', password: 'Sup3rSecret!' });

    const stored = await User.findOne({ email: 'hash@example.com' }).select('+passwordHash');

    expect(stored.passwordHash).not.toBe('Sup3rSecret!');
    expect(stored.passwordHash).toMatch(/^\$2[aby]\$/);
  });

  test('rejects a duplicate email with a safe 409', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'dupe@example.com', password: 'Sup3rSecret!' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'dupe@example.com', password: 'AnotherPass1!' });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: { message: 'An account with this email already exists.', code: 'EMAIL_TAKEN' },
    });
  });

  test('normalizes email casing/whitespace before storing and checking duplicates', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: '  Case@Example.com  ', password: 'Sup3rSecret!' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'case@example.com', password: 'AnotherPass1!' });

    expect(res.status).toBe(409);
  });

  test('rejects an invalid email format', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: 'Sup3rSecret!' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_EMAIL');
  });

  test('rejects a password shorter than the minimum length', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'short@example.com', password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_PASSWORD');
  });

  test('rejects a password longer than bcrypt can safely handle', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'longpw@example.com', password: 'a'.repeat(73) });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_PASSWORD');
  });

  test('rejects an email longer than 254 characters', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: `${'a'.repeat(250)}@example.com`, password: 'Sup3rSecret!' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_EMAIL');
  });

  test('rejects a missing request body safely', async () => {
    const res = await request(app).post('/api/auth/register').send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_EMAIL');
  });

  test('rejects a request with no body/Content-Type at all, without a 500', async () => {
    const res = await request(app).post('/api/auth/register');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_EMAIL');
  });
});

describe('POST /api/auth/login', () => {
  test('creates an authenticated session for correct credentials', async () => {
    const { email, password } = await registerUser();

    const res = await request(app).post('/api/auth/login').send({ email, password });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      user: {
        id: expect.any(String),
        email,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      },
    });
  });

  test('sets a HttpOnly + SameSite=Lax session cookie carrying a 24h JWT', async () => {
    const { email, password } = await registerUser({ email: 'cookie@example.com' });

    const res = await request(app).post('/api/auth/login').send({ email, password });

    const cookies = res.headers['set-cookie'];
    const sessionCookie = cookies.find((cookie) => cookie.startsWith(`${SESSION_COOKIE_NAME}=`));

    expect(sessionCookie).toBeDefined();
    expect(sessionCookie).toMatch(/HttpOnly/i);
    expect(sessionCookie).toMatch(/SameSite=Lax/i);
    // NODE_ENV is 'test' here, matching local (non-production) dev; Secure only applies in production.
    expect(sessionCookie).not.toMatch(/Secure/i);

    const token = sessionCookie.split(';')[0].split('=')[1];
    const payload = jwt.verify(token, env.jwtSecret);
    const user = await User.findOne({ email });

    expect(payload.sub).toBe(user.id);
    expect(payload.exp - payload.iat).toBe(24 * 60 * 60);
  });

  test('rejects an unknown email with a safe generic failure', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'Sup3rSecret!' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: { message: 'Invalid email or password.', code: 'INVALID_CREDENTIALS' },
    });
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  test('rejects a wrong password with the same safe generic failure', async () => {
    const { email } = await registerUser({ email: 'wrongpass@example.com' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'TotallyWrong1!' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: { message: 'Invalid email or password.', code: 'INVALID_CREDENTIALS' },
    });
  });

  test('rejects a missing request body safely', async () => {
    const res = await request(app).post('/api/auth/login').send({});

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: { message: 'Invalid email or password.', code: 'INVALID_CREDENTIALS' },
    });
  });

  test('rejects a request with no body/Content-Type at all, without a 500', async () => {
    const res = await request(app).post('/api/auth/login');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: { message: 'Invalid email or password.', code: 'INVALID_CREDENTIALS' },
    });
  });
});

describe('GET /api/auth/me', () => {
  test('returns the current user for a valid session', async () => {
    const { agent, email } = await loginAgent({ email: 'me@example.com' });

    const res = await agent.get('/api/auth/me');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      user: {
        id: expect.any(String),
        email,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      },
    });
  });

  test('rejects with a safe 401 when there is no session cookie', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: { message: 'Not authenticated.', code: 'UNAUTHENTICATED' },
    });
  });

  test('rejects with a safe 401 for a tampered/invalid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', [`${SESSION_COOKIE_NAME}=not-a-real-token`]);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: { message: 'Session expired or invalid.', code: 'INVALID_SESSION' },
    });
  });

  test('rejects with a safe 401 for an expired token', async () => {
    const { email } = await registerUser({ email: 'expired@example.com' });
    const user = await User.findOne({ email });
    const expiredToken = jwt.sign({ sub: user.id }, env.jwtSecret, { expiresIn: -1 });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', [`${SESSION_COOKIE_NAME}=${expiredToken}`]);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_SESSION');
  });
});

describe('POST /api/auth/logout', () => {
  test('clears the session cookie', async () => {
    const { agent } = await loginAgent({ email: 'logout@example.com' });

    const res = await agent.post('/api/auth/logout');

    expect(res.status).toBe(204);
    const clearedCookie = res.headers['set-cookie'].find((cookie) =>
      cookie.startsWith(`${SESSION_COOKIE_NAME}=`),
    );
    expect(clearedCookie).toMatch(/Expires=Thu, 01 Jan 1970/i);
  });

  test('logging out actually ends the session (subsequent /me fails)', async () => {
    const { agent } = await loginAgent({ email: 'logout2@example.com' });

    await agent.post('/api/auth/logout');
    const res = await agent.get('/api/auth/me');

    expect(res.status).toBe(401);
  });

  test('is safe to call without an active session', async () => {
    const res = await request(app).post('/api/auth/logout');

    expect(res.status).toBe(204);
  });
});

describe('full F02 session lifecycle', () => {
  test('register -> login -> restore -> logout -> session ends, end to end', async () => {
    const email = 'lifecycle@example.com';
    const password = 'Sup3rSecret!';
    const agent = request.agent(app);

    const registerRes = await agent.post('/api/auth/register').send({ email, password });
    expect(registerRes.status).toBe(201);

    const loginRes = await agent.post('/api/auth/login').send({ email, password });
    expect(loginRes.status).toBe(200);

    const meRes = await agent.get('/api/auth/me');
    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe(email);
    expect(meRes.body.user.id).toBe(loginRes.body.user.id);

    const logoutRes = await agent.post('/api/auth/logout');
    expect(logoutRes.status).toBe(204);

    const meAfterLogoutRes = await agent.get('/api/auth/me');
    expect(meAfterLogoutRes.status).toBe(401);
  });
});
