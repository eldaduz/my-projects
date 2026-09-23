import { describe, test, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// Isolated module graph with a generous rate limit — this file is about
// concurrency-slot release timing, not rate limiting, so a low
// AI_RATE_LIMIT_MAX (as other AI test files deliberately set) would
// contaminate the results. Same isolation pattern as the other AI test files.
let mongod;
let app;
let createApp;
let Trip;
let User;
let createFakeGeminiAdapter;
let validItinerary;

beforeAll(async () => {
  process.env.AI_RATE_LIMIT_MAX = '100';
  process.env.AI_RATE_LIMIT_WINDOW_MS = '60000';
  process.env.AI_RATE_LIMIT_IP_MAX = '100';
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

describe('AI concurrency slot release (ATP-70 fix)', () => {
  test('the slot is released once the handler completes, independent of response socket events', async () => {
    const fake = createFakeGeminiAdapter({ generateResponseText: JSON.stringify(validItinerary) });
    app = createApp({ geminiAdapter: fake });
    const agent = await agentFor('slot-release-user@example.com');

    const firstId = await readyTrip(agent, 'First');
    const firstResponse = await agent.post(`/api/trips/${firstId}/generate-itinerary`);
    expect(firstResponse.status).toBe(200);

    // If the guard's release were still tied to a socket event that can be
    // missed (the original bug), the slot would still be held here and this
    // second, fully sequential (non-concurrent) request would wrongly 409.
    const secondId = await readyTrip(agent, 'Second');
    const secondResponse = await agent.post(`/api/trips/${secondId}/generate-itinerary`);
    expect(secondResponse.status).toBe(200);
  });

  test('the slot is released even on an early-return failure path (trip not ready)', async () => {
    const fake = createFakeGeminiAdapter({ generateResponseText: JSON.stringify(validItinerary) });
    app = createApp({ geminiAdapter: fake });
    const agent = await agentFor('slot-release-early-return@example.com');

    // A DRAFT trip is not READY_FOR_GENERATION — the handler returns 409
    // before doing any Gemini work, but the concurrency guard still ran and
    // must still release the slot via the handler's finally block.
    const created = await agent.post('/api/trips').send({ destination: 'Rome' });
    const notReadyId = created.body.trip.id;
    const notReadyResponse = await agent.post(`/api/trips/${notReadyId}/generate-itinerary`);
    expect(notReadyResponse.status).toBe(409);
    expect(notReadyResponse.body.error.code).toBe('TRIP_NOT_READY');

    const readyId = await readyTrip(agent, 'Actually ready');
    const readyResponse = await agent.post(`/api/trips/${readyId}/generate-itinerary`);
    expect(readyResponse.status).toBe(200);
  });
});
