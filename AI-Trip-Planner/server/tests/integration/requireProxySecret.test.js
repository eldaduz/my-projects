import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// Isolated module graph so NODE_ENV=production (and the env var it requires)
// only apply to this file's env.js/app.js instances — same pattern as
// trustProxy.test.js.
let mongod;
let app;

beforeAll(async () => {
  process.env.NODE_ENV = 'production';
  process.env.INTERNAL_PROXY_SECRET = 'test-proxy-secret';
  vi.resetModules();

  const { createApp } = await import('../../src/app.js');
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  app = createApp({});
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) {
    await mongod.stop();
  }
  process.env.NODE_ENV = 'test';
  delete process.env.INTERNAL_PROXY_SECRET;
});

describe('requireProxySecret (ATP-85, NODE_ENV=production)', () => {
  test('a request with no proxy secret is rejected', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'a@example.com', password: 'x' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN_ORIGIN');
  });

  test('a request with the wrong proxy secret is rejected', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('x-internal-proxy-secret', 'not-the-secret')
      .send({ email: 'a@example.com', password: 'x' });
    expect(res.status).toBe(403);
  });

  test('a request carrying the correct proxy secret reaches the route (past this middleware)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('x-internal-proxy-secret', 'test-proxy-secret')
      .send({ email: 'a@example.com', password: 'x' });
    // Wrong credentials, but it got past requireProxySecret to the real
    // auth logic — proves the header check isn't what's rejecting it.
    expect(res.status).not.toBe(403);
  });

  test('/api/health stays reachable without the proxy secret (Render platform health checks hit it directly)', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
  });
});
