import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// This file sets a tiny AUTH_RATE_LIMIT_MAX before importing the app, so it
// must not share a module graph (and thus the env/rate-limiter singleton)
// with other test files that expect the high default from tests/setup.js.
// vitest isolates each test file's modules by default, and vi.resetModules()
// plus a dynamic import here guarantees a fresh env/app for this file alone.

let mongod;
let app;

beforeAll(async () => {
  process.env.AUTH_RATE_LIMIT_MAX = '3';
  process.env.AUTH_RATE_LIMIT_WINDOW_MS = '60000';
  vi.resetModules();

  const { createApp } = await import('../../src/app.js');

  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  app = createApp();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('Auth rate limiting (ATP-34)', () => {
  test('rejects requests beyond the configured limit with a safe 429', async () => {
    for (let i = 0; i < 3; i += 1) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: `x${i}@example.com`, password: 'wrong-password' });
      expect(res.status).toBe(401);
    }

    const limited = await request(app)
      .post('/api/auth/login')
      .send({ email: 'x99@example.com', password: 'wrong-password' });

    expect(limited.status).toBe(429);
    expect(limited.body).toEqual({
      error: { message: 'Too many attempts. Please try again later.', code: 'RATE_LIMITED' },
    });
  });
});
