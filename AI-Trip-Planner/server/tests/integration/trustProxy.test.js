import { describe, test, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// Isolated module graph (own tiny AI_RATE_LIMIT_IP_MAX) — same pattern as
// aiAbuseProtection.test.js and authRateLimit.test.js.
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
  process.env.AI_RATE_LIMIT_IP_MAX = '2';
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

describe('trust proxy / per-IP rate limiting (ATP-70 fix)', () => {
  test('a different client IP (via X-Forwarded-For) is not penalized by another IP exhausting its bucket', async () => {
    const agent = await agentFor('trust-proxy-user@example.com');

    for (let i = 0; i < 2; i += 1) {
      const id = await readyTrip(agent, `IP-A trip ${i}`);
      const res = await agent
        .post(`/api/trips/${id}/generate-itinerary`)
        .set('X-Forwarded-For', '203.0.113.10');
      expect(res.status).toBe(200);
    }

    const exhaustedId = await readyTrip(agent, 'IP-A trip exhausted');
    const exhausted = await agent
      .post(`/api/trips/${exhaustedId}/generate-itinerary`)
      .set('X-Forwarded-For', '203.0.113.10');
    expect(exhausted.status).toBe(429);

    // A different client IP must get its own bucket — this only holds if
    // Express is configured to trust the proxy and read X-Forwarded-For
    // instead of resolving every request to the same socket address.
    const otherIpId = await readyTrip(agent, 'IP-B trip');
    const otherIp = await agent
      .post(`/api/trips/${otherIpId}/generate-itinerary`)
      .set('X-Forwarded-For', '198.51.100.20');
    expect(otherIp.status).toBe(200);
  });

  test('two real clients sharing the same Vercel egress hop get separate buckets, not one shared bucket', async () => {
    // Production is browser -> Vercel (rewrite) -> Render -> this app: two
    // proxy hops. X-Forwarded-For arrives as "<real client>, <Vercel egress>".
    // Both users below share the same rightmost (Vercel) hop but have
    // different real client addresses — this is exactly the scenario a
    // too-low trust-proxy hop count collapses into one bucket.
    const sharedVercelEgress = '76.76.21.21';
    const clientA = await agentFor('multihop-client-a@example.com');
    const clientB = await agentFor('multihop-client-b@example.com');

    for (let i = 0; i < 2; i += 1) {
      const id = await readyTrip(clientA, `A trip ${i}`);
      const res = await clientA
        .post(`/api/trips/${id}/generate-itinerary`)
        .set('X-Forwarded-For', `198.51.100.30, ${sharedVercelEgress}`);
      expect(res.status).toBe(200);
    }
    const aExhaustedId = await readyTrip(clientA, 'A trip exhausted');
    const aExhausted = await clientA
      .post(`/api/trips/${aExhaustedId}/generate-itinerary`)
      .set('X-Forwarded-For', `198.51.100.30, ${sharedVercelEgress}`);
    expect(aExhausted.status).toBe(429);

    // Client B, a genuinely different real IP behind the same Vercel egress,
    // must not have been penalized by A exhausting the bucket.
    const bId = await readyTrip(clientB, 'B trip');
    const bResponse = await clientB
      .post(`/api/trips/${bId}/generate-itinerary`)
      .set('X-Forwarded-For', `198.51.100.31, ${sharedVercelEgress}`);
    expect(bResponse.status).toBe(200);
  });
});
