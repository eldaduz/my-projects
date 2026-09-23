import { describe, test, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// Isolated module graph (own tiny AI_RATE_LIMIT_MAX / AI_RATE_LIMIT_IP_MAX)
// — same pattern as aiAbuseProtection.test.js and trustProxy.test.js.
let mongod;
let app;
let createApp;
let Trip;
let User;
let createFakeGeminiAdapter;
let validItinerary;

beforeAll(async () => {
  process.env.AI_RATE_LIMIT_MAX = '2';
  process.env.AI_RATE_LIMIT_WINDOW_MS = '60000';
  process.env.AI_RATE_LIMIT_IP_MAX = '3';
  vi.resetModules();

  ({ createApp } = await import('../../src/app.js'));
  ({ Trip } = await import('../../src/modules/trips/trip.model.js'));
  ({ User } = await import('../../src/modules/auth/user.model.js'));
  ({ createFakeGeminiAdapter } = await import('../../src/modules/ai/fakeGeminiAdapter.js'));
  validItinerary = (await import('../fixtures/itineraries/validBalancedItinerary.json')).default;

  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  const fake = createFakeGeminiAdapter({ generateResponseText: JSON.stringify(validItinerary) });
  app = createApp({ geminiAdapter: fake });
});

afterEach(async () => {
  await User.deleteMany({});
  await Trip.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

async function agentFor(email) {
  const password = 'Sup3rSecret!';
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({ email, password });
  await agent.post('/api/auth/login').send({ email, password });
  return agent;
}

async function readyTrip(agent, destination) {
  const created = await agent.post('/api/trips').send({
    destination, startDate: '2026-09-01', endDate: '2026-09-02', wizardStep: 2,
  });
  const id = created.body.trip.id;
  await agent.patch(`/api/trips/${id}`).send({ addTripOnlyTraveler: { travelerName: 'Sam' }, wizardStep: 3 });
  await agent.patch(`/api/trips/${id}`).send({ wizardStep: 4 });
  await agent.patch(`/api/trips/${id}`).send({ markReadyForGeneration: true });
  return id;
}

async function generate(agent, ip, destination) {
  const id = await readyTrip(agent, destination);
  return agent
    .post(`/api/trips/${id}/generate-itinerary`)
    .set('X-Forwarded-For', ip);
}

describe('AI rate-limiter ordering (ATP-70 fix)', () => {
  test('a user retrying past their own quota does not consume the shared per-IP bucket', async () => {
    const sharedIp = '203.0.113.77';
    const userA = await agentFor('ordering-user-a@example.com');
    const userB = await agentFor('ordering-user-b@example.com');

    // User A: 2 successful calls exhaust their own quota (AI_RATE_LIMIT_MAX=2)
    // and legitimately consume 2 of the shared IP bucket's 3 slots.
    for (let i = 0; i < 2; i += 1) {
      const res = await generate(userA, sharedIp, `A-ok-${i}`);
      expect(res.status).toBe(200);
    }

    // User A retries 3 more times after exhausting their own quota. If the
    // per-user limiter runs before the per-IP limiter, none of these should
    // reach (or consume) the shared IP bucket.
    for (let i = 0; i < 3; i += 1) {
      const res = await generate(userA, sharedIp, `A-over-${i}`);
      expect(res.status).toBe(429);
    }

    // User B, behind the same IP, should still have 1 of the 3 IP slots
    // left (2 used by A's legitimate successes, 0 by A's rejected retries).
    const bFirst = await generate(userB, sharedIp, 'B-1');
    expect(bFirst.status).toBe(200);

    // The IP bucket is now fully exhausted (3/3) — a second request from B
    // correctly hits the shared IP limit.
    const bSecond = await generate(userB, sharedIp, 'B-2');
    expect(bSecond.status).toBe(429);
    expect(bSecond.body.error.code).toBe('AI_RATE_LIMITED');
  });
});
