import { describe, test, expect, beforeAll, afterEach, afterAll } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { User } from '../../src/modules/auth/user.model.js';
import { signSessionToken, setSessionCookie } from '../../src/modules/auth/session.js';
import { requireAuth } from '../../src/middleware/requireAuth.js';
import { loadOwnedResource } from '../../src/middleware/loadOwnedResource.js';
import { errorHandler, notFoundHandler } from '../../src/middleware/errorHandler.js';

// A throwaway user-owned resource, standing in for the real Trip/TravelerProfile
// models that reuse this same pattern starting in F04/F06.
const thingSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  label: String,
});
const Thing = mongoose.model('OwnershipTestThing', thingSchema);

let mongod;
let app;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  app = express();
  app.use(cookieParser());
  // Test-only login shortcut: this standalone app only mounts the ownership
  // route under test, so it issues a real session cookie without going
  // through the full /api/auth/login flow tested elsewhere.
  app.post('/test-login/:userId', (req, res) => {
    setSessionCookie(res, signSessionToken(req.params.userId));
    res.status(204).end();
  });
  app.get(
    '/things/:id',
    requireAuth,
    loadOwnedResource(Thing, { resourceKey: 'thing' }),
    (req, res) => res.status(200).json({ id: req.thing.id, label: req.thing.label }),
  );
  app.use(notFoundHandler);
  app.use(errorHandler);
});

afterEach(async () => {
  await User.deleteMany({});
  await Thing.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

async function agentFor(email) {
  const user = await User.create({ email, passwordHash: 'irrelevant-for-this-test' });
  const agent = request.agent(app);
  await agent.post(`/test-login/${user._id}`);
  return { agent, user };
}

describe('loadOwnedResource', () => {
  test('lets the owner load their own resource', async () => {
    const { agent, user } = await agentFor('owner@example.com');
    const thing = await Thing.create({ userId: user._id, label: 'mine' });

    const res = await agent.get(`/things/${thing.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: thing.id, label: 'mine' });
  });

  test('returns 404 (not 403) for a resource owned by someone else', async () => {
    const owner = await User.create({ email: 'a@example.com', passwordHash: 'x' });
    const thing = await Thing.create({ userId: owner._id, label: 'not-yours' });
    const { agent } = await agentFor('b@example.com');

    const res = await agent.get(`/things/${thing.id}`);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { message: 'Not found.', code: 'NOT_FOUND' } });
  });

  test('returns 404 for a well-formed but nonexistent id', async () => {
    const { agent } = await agentFor('c@example.com');
    const missingId = new mongoose.Types.ObjectId().toString();

    const res = await agent.get(`/things/${missingId}`);

    expect(res.status).toBe(404);
  });

  test('returns 404 (not 500) for a malformed id', async () => {
    const { agent } = await agentFor('d@example.com');

    const res = await agent.get('/things/not-an-object-id');

    expect(res.status).toBe(404);
  });

  test('rejects with 401 when there is no session at all', async () => {
    const res = await request(app).get(`/things/${new mongoose.Types.ObjectId()}`);

    expect(res.status).toBe(401);
  });
});
