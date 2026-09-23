import { describe, test, expect, beforeAll, afterEach, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../../src/app.js';
import { User } from '../../src/modules/auth/user.model.js';
import { Trip } from '../../src/modules/trips/trip.model.js';
import { createFakeGeminiAdapter } from '../../src/modules/ai/fakeGeminiAdapter.js';
import { GeminiRequestError } from '../../src/modules/ai/geminiAdapter.js';
import validItinerary from '../fixtures/itineraries/validBalancedItinerary.json';

let mongod;
let app;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterEach(async () => {
  await User.deleteMany({});
  await Trip.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

async function agentFor(email = 'generator@example.com') {
  const password = 'Sup3rSecret!';
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({ email, password });
  await agent.post('/api/auth/login').send({ email, password });
  return agent;
}

async function readyTrip(agent) {
  const created = await agent.post('/api/trips').send({
    destination: 'Rome',
    startDate: '2026-09-01',
    endDate: '2026-09-02',
    wizardStep: 2,
  });
  const id = created.body.trip.id;
  await agent.patch(`/api/trips/${id}`).send({
    addTripOnlyTraveler: { travelerName: 'Sam' },
    wizardStep: 3,
  });
  await agent.patch(`/api/trips/${id}`).send({ wizardStep: 4 });
  await agent.patch(`/api/trips/${id}`).send({ markReadyForGeneration: true });
  return id;
}

describe('POST /api/trips/:id/generate-itinerary', () => {
  test('rejects unauthenticated requests before loading or calling the adapter', async () => {
    const fake = createFakeGeminiAdapter({ generateResponseText: JSON.stringify(validItinerary) });
    app = createApp({ geminiAdapter: fake });
    const agent = await agentFor('unauthenticated@example.com');
    const id = await readyTrip(agent);

    const res = await request(app).post(`/api/trips/${id}/generate-itinerary`);

    expect(res.status).toBe(401);
    expect(fake.generateCalls).toHaveLength(0);
  });

  test('rejects a non-owner without calling the adapter or mutating the trip', async () => {
    const fake = createFakeGeminiAdapter({ generateResponseText: JSON.stringify(validItinerary) });
    app = createApp({ geminiAdapter: fake });
    const owner = await agentFor('owner@example.com');
    const id = await readyTrip(owner);
    const before = await Trip.findById(id).lean();
    const stranger = await agentFor('stranger@example.com');

    const res = await stranger.post(`/api/trips/${id}/generate-itinerary`);
    const after = await Trip.findById(id).lean();

    expect(res.status).toBe(404);
    expect(fake.generateCalls).toHaveLength(0);
    expect(after).toEqual(before);
  });

  test.each(['DRAFT', 'PLANNED'])('rejects a %s trip without calling the adapter', async (status) => {
    const fake = createFakeGeminiAdapter({ generateResponseText: JSON.stringify(validItinerary) });
    app = createApp({ geminiAdapter: fake });
    const agent = await agentFor(`${status.toLowerCase()}@example.com`);
    let id;
    if (status === 'DRAFT') {
      const created = await agent.post('/api/trips').send({ destination: 'Rome' });
      id = created.body.trip.id;
    } else {
      id = await readyTrip(agent);
      await Trip.findByIdAndUpdate(id, { status });
    }
    const before = await Trip.findById(id).lean();

    const res = await agent.post(`/api/trips/${id}/generate-itinerary`);
    const after = await Trip.findById(id).lean();

    expect(res.status).toBe(409);
    expect(fake.generateCalls).toHaveLength(0);
    expect(after).toEqual(before);
  });

  test('persists a valid first response with PLANNED/CURRENT and no correction', async () => {
    const fake = createFakeGeminiAdapter({ generateResponseText: JSON.stringify(validItinerary) });
    app = createApp({ geminiAdapter: fake });
    const agent = await agentFor();
    const id = await readyTrip(agent);

    const res = await agent.post(`/api/trips/${id}/generate-itinerary`);

    expect(res.status).toBe(200);
    expect(res.body.trip).toMatchObject({ status: 'PLANNED', itineraryStatus: 'CURRENT' });
    expect(res.body.trip.currentItinerary.days[0].activities[0].id).toEqual(expect.any(String));
    expect(fake.generateCalls).toHaveLength(1);
    expect(fake.correctionCalls).toHaveLength(0);
  });

  test('corrects one invalid response and persists only the finalized correction', async () => {
    const fake = createFakeGeminiAdapter({
      generateResponseText: JSON.stringify({ destination: '', days: [] }),
      correctionResponseText: JSON.stringify(validItinerary),
    });
    app = createApp({ geminiAdapter: fake });
    const agent = await agentFor('correct@example.com');
    const id = await readyTrip(agent);

    const res = await agent.post(`/api/trips/${id}/generate-itinerary`);

    expect(res.status).toBe(200);
    expect(res.body.trip.status).toBe('PLANNED');
    expect(fake.generateCalls).toHaveLength(1);
    expect(fake.correctionCalls).toHaveLength(1);
    expect(res.body.trip.currentItinerary.destination).toBe(validItinerary.destination);
  });

  test('restores ready state and prior itinerary after final invalid output', async () => {
    const fake = createFakeGeminiAdapter({
      generateResponseText: JSON.stringify({ destination: '', days: [] }),
      correctionResponseText: JSON.stringify({ destination: '', days: [] }),
    });
    app = createApp({ geminiAdapter: fake });
    const agent = await agentFor('invalid@example.com');
    const id = await readyTrip(agent);
    const prior = { destination: 'Old Rome', days: [] };
    await Trip.findByIdAndUpdate(id, { status: 'READY_FOR_GENERATION', itineraryStatus: 'STALE', currentItinerary: prior });

    const res = await agent.post(`/api/trips/${id}/generate-itinerary`);
    const stored = await Trip.findById(id).lean();

    expect(res.status).toBe(502);
    expect(res.body.error.message).not.toMatch(/SCHEMA|destination|days|Gemini|provider/i);
    expect(stored).toMatchObject({ status: 'READY_FOR_GENERATION', itineraryStatus: 'STALE', currentItinerary: prior });
    expect(fake.correctionCalls).toHaveLength(1);
  });

  test('restores ready state after a provider failure without exposing provider details', async () => {
    const fake = createFakeGeminiAdapter({ generateError: new Error('provider secret details') });
    app = createApp({ geminiAdapter: fake });
    const agent = await agentFor('provider-failure@example.com');
    const id = await readyTrip(agent);

    const res = await agent.post(`/api/trips/${id}/generate-itinerary`);
    const stored = await Trip.findById(id).lean();

    expect(res.status).toBe(502);
    expect(res.body.error.message).not.toContain('provider secret');
    expect(stored).toMatchObject({ status: 'READY_FOR_GENERATION', currentItinerary: null });
    expect(fake.generateCalls).toHaveLength(1);
    expect(fake.correctionCalls).toHaveLength(0);
  });

  test('restores ready state and prior itinerary when correction fails', async () => {
    const fake = createFakeGeminiAdapter({
      generateResponseText: JSON.stringify({ destination: '', days: [] }),
      correctionError: new Error('correction provider secret details'),
    });
    app = createApp({ geminiAdapter: fake });
    const agent = await agentFor('correction-failure@example.com');
    const id = await readyTrip(agent);
    const prior = {
      destination: 'Old Rome',
      days: [{ day: 1, title: 'Existing plan', activities: [] }],
    };
    await Trip.findByIdAndUpdate(id, {
      status: 'READY_FOR_GENERATION',
      itineraryStatus: 'STALE',
      currentItinerary: prior,
    });

    const res = await agent.post(`/api/trips/${id}/generate-itinerary`);
    const stored = await Trip.findById(id).lean();

    expect(res.status).toBe(502);
    expect(res.body.error.message).not.toContain('correction provider secret');
    expect(fake.generateCalls).toHaveLength(1);
    expect(fake.correctionCalls).toHaveLength(1);
    expect(stored).toMatchObject({
      status: 'READY_FOR_GENERATION',
      itineraryStatus: 'STALE',
      currentItinerary: prior,
    });
  });

  test('returns a friendly 429 when Gemini itself is rate-limited, and reverts the trip', async () => {
    const fake = createFakeGeminiAdapter({
      generateError: new GeminiRequestError('rate limited', 'RATE_LIMITED'),
    });
    app = createApp({ geminiAdapter: fake });
    const agent = await agentFor('rate-limited@example.com');
    const id = await readyTrip(agent);

    const res = await agent.post(`/api/trips/${id}/generate-itinerary`);
    const trip = await Trip.findById(id).lean();

    expect(res.status).toBe(429);
    expect(res.body).toEqual({
      error: { message: 'The AI service is busy right now. Please try again shortly.', code: 'AI_PROVIDER_BUSY' },
    });
    expect(trip.status).toBe('READY_FOR_GENERATION');
  });

  test('returns the existing safe 502 when Gemini is unavailable after retry', async () => {
    const fake = createFakeGeminiAdapter({
      generateError: new GeminiRequestError('unavailable', 'PROVIDER_UNAVAILABLE'),
    });
    app = createApp({ geminiAdapter: fake });
    const agent = await agentFor('unavailable@example.com');
    const id = await readyTrip(agent);

    const res = await agent.post(`/api/trips/${id}/generate-itinerary`);

    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('ITINERARY_GENERATION_FAILED');
    expect(res.body.error.message).not.toMatch(/PROVIDER|Gemini|provider/i);
  });

  test('rejects a second request while the first is generating', async () => {
    let release;
    let resolveStarted;
    const deferred = new Promise((resolve) => { release = resolve; });
    const started = new Promise((resolve) => { resolveStarted = resolve; });
    const fake = createFakeGeminiAdapter({
      generateResponse: () => {
        resolveStarted();
        return deferred;
      },
    });
    app = createApp({ geminiAdapter: fake });
    const agent = await agentFor('deferred@example.com');
    const id = await readyTrip(agent);
    const observer = await agentFor('deferred@example.com');
    const first = agent.post(`/api/trips/${id}/generate-itinerary`);
    first.then(() => {}, () => {});

    await started;
    const during = await observer.get(`/api/trips/${id}`);
    const duplicate = await observer.post(`/api/trips/${id}/generate-itinerary`);

    expect(during.body.trip.status).toBe('GENERATING');
    expect(during.body.trip.startedAt).toEqual(expect.any(String));
    expect(duplicate.status).toBe(409);
    release(JSON.stringify(validItinerary));
    await first;
  });
});
