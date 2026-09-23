import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../../src/app.js';
import { User } from '../../src/modules/auth/user.model.js';
import { Trip } from '../../src/modules/trips/trip.model.js';
import { createFakeGeminiAdapter } from '../../src/modules/ai/fakeGeminiAdapter.js';
import { recoverStaleTrip } from '../../src/modules/trips/staleAiOperationRecovery.js';

let mongod;
let app;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  app = createApp({ geminiAdapter: createFakeGeminiAdapter({ responseText: '{}' }) });
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

describe('Stale AI operation recovery (ATP-71)', () => {
  test('reverts a stale GENERATING trip to READY_FOR_GENERATION on next read', async () => {
    const agent = await agentFor('stale-generating@example.com');
    const created = await agent.post('/api/trips').send({ destination: 'Rome' });
    const id = created.body.trip.id;
    await Trip.findByIdAndUpdate(id, {
      status: 'GENERATING',
      startedAt: new Date(Date.now() - 3 * 60 * 1000),
    });

    const res = await agent.get(`/api/trips/${id}`);

    expect(res.status).toBe(200);
    expect(res.body.trip.status).toBe('READY_FOR_GENERATION');
    expect(res.body.trip.startedAt).toBeNull();
  });

  test('reverts a stale REPLANNING trip to PLANNED and preserves its itinerary', async () => {
    const agent = await agentFor('stale-replanning@example.com');
    const created = await agent.post('/api/trips').send({ destination: 'Rome' });
    const id = created.body.trip.id;
    const priorItinerary = { destination: 'Rome', days: [] };
    await Trip.findByIdAndUpdate(id, {
      status: 'REPLANNING',
      startedAt: new Date(Date.now() - 3 * 60 * 1000),
      currentItinerary: priorItinerary,
      itineraryStatus: 'CURRENT',
    });

    const res = await agent.get(`/api/trips/${id}`);

    expect(res.status).toBe(200);
    expect(res.body.trip.status).toBe('PLANNED');
    expect(res.body.trip.itineraryStatus).toBe('CURRENT');
    expect(res.body.trip.currentItinerary.destination).toBe('Rome');
  });

  test('leaves a recent (not stale) GENERATING trip untouched', async () => {
    const agent = await agentFor('fresh-generating@example.com');
    const created = await agent.post('/api/trips').send({ destination: 'Rome' });
    const id = created.body.trip.id;
    await Trip.findByIdAndUpdate(id, { status: 'GENERATING', startedAt: new Date() });

    const res = await agent.get(`/api/trips/${id}`);

    expect(res.status).toBe(200);
    expect(res.body.trip.status).toBe('GENERATING');
  });

  test('reverts a stale GENERATING trip in the trip list, not just GET /:id', async () => {
    const agent = await agentFor('stale-in-list@example.com');
    const created = await agent.post('/api/trips').send({ destination: 'Rome' });
    const id = created.body.trip.id;
    await Trip.findByIdAndUpdate(id, {
      status: 'GENERATING',
      startedAt: new Date(Date.now() - 3 * 60 * 1000),
    });

    const res = await agent.get('/api/trips');

    expect(res.status).toBe(200);
    const listed = res.body.trips.find((trip) => trip.id === id);
    expect(listed.status).toBe('READY_FOR_GENERATION');
    expect(listed.startedAt).toBeNull();

    const persisted = await Trip.findById(id).lean();
    expect(persisted.status).toBe('READY_FOR_GENERATION');
  });

  test('does not overwrite a trip that legitimately progressed past GENERATING between read and recovery', async () => {
    const agent = await agentFor('recovery-race@example.com');
    const created = await agent.post('/api/trips').send({ destination: 'Rome' });
    const id = created.body.trip.id;
    const staleStartedAt = new Date(Date.now() - 3 * 60 * 1000);
    await Trip.findByIdAndUpdate(id, { status: 'GENERATING', startedAt: staleStartedAt });

    // Reader B loads a snapshot while the trip is (correctly, at that
    // moment) stale-looking GENERATING.
    const staleSnapshot = await Trip.findById(id);

    // Reader A (a real concurrent generation) finishes and legitimately
    // moves the trip forward before reader B's recovery write lands.
    const finishedItinerary = { destination: 'Rome', days: [] };
    await Trip.findByIdAndUpdate(id, {
      status: 'PLANNED',
      startedAt: null,
      currentItinerary: finishedItinerary,
      itineraryStatus: 'CURRENT',
    });

    // Reader B's recovery must lose this race, not clobber A's real progress.
    const recovered = await recoverStaleTrip(staleSnapshot);
    expect(recovered).toBe(false);

    const persisted = await Trip.findById(id).lean();
    expect(persisted.status).toBe('PLANNED');
    expect(persisted.currentItinerary.destination).toBe('Rome');
    expect(persisted.itineraryStatus).toBe('CURRENT');

    // The in-memory snapshot passed to recoverStaleTrip should also have
    // been refreshed to reflect reality, not left showing stale GENERATING.
    expect(staleSnapshot.status).toBe('PLANNED');
  });
});
