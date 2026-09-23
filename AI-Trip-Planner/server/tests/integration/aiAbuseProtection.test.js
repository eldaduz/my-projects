import { describe, test, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// Sets tiny AI_RATE_LIMIT_MAX/WINDOW before importing the app so this file
// doesn't share the rate-limiter singleton with other test files — same
// isolation pattern as tests/integration/authRateLimit.test.js.
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
  process.env.AI_RATE_LIMIT_IP_MAX = '50';
  vi.resetModules();

  ({ createApp } = await import('../../src/app.js'));
  ({ Trip } = await import('../../src/modules/trips/trip.model.js'));
  ({ User } = await import('../../src/modules/auth/user.model.js'));
  ({ createFakeGeminiAdapter } = await import('../../src/modules/ai/fakeGeminiAdapter.js'));
  validItinerary = (await import('../fixtures/itineraries/validBalancedItinerary.json')).default;

  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
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

async function readyTrip(agent, destination = 'Rome') {
  const created = await agent.post('/api/trips').send({
    destination,
    startDate: '2026-09-01',
    endDate: '2026-09-02',
    wizardStep: 2,
  });
  const id = created.body.trip.id;
  await agent.patch(`/api/trips/${id}`).send({ addTripOnlyTraveler: { travelerName: 'Sam' }, wizardStep: 3 });
  await agent.patch(`/api/trips/${id}`).send({ wizardStep: 4 });
  await agent.patch(`/api/trips/${id}`).send({ markReadyForGeneration: true });
  return id;
}

describe('AI abuse protection (ATP-70)', () => {
  test('rejects a request beyond the per-user AI rate limit with a safe 429', async () => {
    const fake = createFakeGeminiAdapter({ generateResponseText: JSON.stringify(validItinerary) });
    app = createApp({ geminiAdapter: fake });
    const agent = await agentFor('ratelimited-user@example.com');

    for (let i = 0; i < 2; i += 1) {
      const id = await readyTrip(agent, `Destination ${i}`);
      const res = await agent.post(`/api/trips/${id}/generate-itinerary`);
      expect(res.status).toBe(200);
    }

    const id = await readyTrip(agent, 'Destination 2');
    const limited = await agent.post(`/api/trips/${id}/generate-itinerary`);

    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe('AI_RATE_LIMITED');
  });

  test('rejects a second concurrent generation request for the same user with 409', async () => {
    let resolveFirst;
    const fake = createFakeGeminiAdapter({
      generateResponse: () => new Promise((resolve) => { resolveFirst = resolve; }),
    });
    app = createApp({ geminiAdapter: fake });
    const agent = await agentFor('concurrent-user@example.com');
    const firstTripId = await readyTrip(agent, 'First');
    const secondTripId = await readyTrip(agent, 'Second');

    let firstError;
    let firstResponse;
    const firstRequestDone = new Promise((resolve) => {
      agent.post(`/api/trips/${firstTripId}/generate-itinerary`).end((err, res) => {
        firstError = err;
        firstResponse = res;
        resolve();
      });
    });

    // Wait deterministically for the first request to reach the adapter call
    // (which happens after concurrency guard's Set.add). Polling generateCalls
    // is more robust than a fixed wall-clock delay, which can race under CI load.
    let attempts = 0;
    while (fake.generateCalls.length === 0 && attempts < 100) {
      await new Promise((resolve) => setTimeout(resolve, 5));
      attempts += 1;
    }
    if (fake.generateCalls.length === 0) {
      throw new Error('First request did not reach the adapter within timeout');
    }

    const secondResponse = await agent.post(`/api/trips/${secondTripId}/generate-itinerary`);
    expect(secondResponse.status).toBe(409);
    expect(secondResponse.body.error.code).toBe('AI_REQUEST_IN_PROGRESS');

    resolveFirst(JSON.stringify(validItinerary));
    await firstRequestDone;
    if (firstError) throw firstError;
    expect(firstResponse.status).toBe(200);
  });

  test('rejects an oversized request body before any AI middleware or adapter call', async () => {
    const fake = createFakeGeminiAdapter({ generateResponseText: JSON.stringify(validItinerary) });
    app = createApp({ geminiAdapter: fake });
    const agent = await agentFor('oversized-user@example.com');
    const id = await readyTrip(agent);

    const oversizedPayload = 'x'.repeat(200 * 1024); // exceeds the 100kb default JSON_BODY_LIMIT
    const res = await agent
      .post(`/api/trips/${id}/generate-itinerary`)
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ junk: oversizedPayload }));

    expect(res.status).toBe(413);
    expect(fake.generateCalls).toHaveLength(0);
  });
});
