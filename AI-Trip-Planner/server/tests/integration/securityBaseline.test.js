import { describe, test, expect, beforeAll, afterEach, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../../src/app.js';
import { User } from '../../src/modules/auth/user.model.js';
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

describe('Origin validation (ATP-34)', () => {
  test('allows a state-changing request with no Origin header (non-browser client)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'no-origin@example.com', password: 'Sup3rSecret!' });

    expect(res.status).toBe(201);
  });

  test('allows a state-changing request whose Origin matches the configured CORS origin', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('Origin', env.corsOrigin)
      .send({ email: 'matching-origin@example.com', password: 'Sup3rSecret!' });

    expect(res.status).toBe(201);
  });

  test('rejects a state-changing request from an unexpected Origin with a safe 403', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('Origin', 'https://evil.example.com')
      .send({ email: 'bad-origin@example.com', password: 'Sup3rSecret!' });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({
      error: { message: 'Request origin is not allowed.', code: 'INVALID_ORIGIN' },
    });

    const created = await User.findOne({ email: 'bad-origin@example.com' });
    expect(created).toBeNull();
  });

  test('does not enforce Origin on safe GET requests', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'https://evil.example.com');

    expect(res.status).toBe(200);
  });
});

describe('Payload limits (ATP-34)', () => {
  test('rejects an oversized JSON body before it reaches domain logic', async () => {
    const oversizedPassword = 'a'.repeat(200_000);

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'oversized@example.com', password: oversizedPassword });

    expect(res.status).toBe(413);

    const created = await User.findOne({ email: 'oversized@example.com' });
    expect(created).toBeNull();
  });
});

describe('Safe errors (ATP-35)', () => {
  test('a malformed JSON body never leaks a stack trace or internal detail', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('Content-Type', 'application/json')
      .send('{not-valid-json');

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(JSON.stringify(res.body)).not.toMatch(/at\s+\S+\s+\(.*:\d+:\d+\)/); // no stack frames
    expect(res.body.error).not.toHaveProperty('stack');
  });

  test('unknown routes return a generic safe 404, not an Express default page', async () => {
    const res = await request(app).get('/api/definitely-not-a-real-route');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { message: 'Not found', code: 'NOT_FOUND' } });
  });
});
