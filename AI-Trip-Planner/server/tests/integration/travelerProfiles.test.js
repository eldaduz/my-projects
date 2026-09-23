import { describe, test, expect, beforeAll, afterEach, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../../src/app.js';
import { User } from '../../src/modules/auth/user.model.js';
import { TravelerProfile } from '../../src/modules/travelers/travelerProfile.model.js';

let mongod;
let app;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  app = createApp();
});

afterEach(async () => {
  await User.deleteMany({});
  await TravelerProfile.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

async function agentFor(email = 'traveler@example.com') {
  const password = 'Sup3rSecret!';
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({ email, password });
  await agent.post('/api/auth/login').send({ email, password });
  return agent;
}

describe('POST /api/traveler-profiles', () => {
  test('creates a profile with just the required profileName', async () => {
    const agent = await agentFor();

    const res = await agent.post('/api/traveler-profiles').send({ profileName: 'My Partner' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      profile: {
        id: expect.any(String),
        profileName: 'My Partner',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      },
    });
  });

  test('creates a profile with optional ageGroup', async () => {
    const agent = await agentFor();

    const res = await agent.post('/api/traveler-profiles').send({
      profileName: 'My Partner',
      ageGroup: 'adult',
    });

    expect(res.status).toBe(201);
    expect(res.body.profile).toMatchObject({ profileName: 'My Partner', ageGroup: 'adult' });
  });

  test('rejects a missing/blank profileName', async () => {
    const agent = await agentFor();

    const res = await agent.post('/api/traveler-profiles').send({ profileName: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_PROFILE_NAME');
  });

  test('rejects an unrecognized ageGroup', async () => {
    const agent = await agentFor();

    const res = await agent
      .post('/api/traveler-profiles')
      .send({ profileName: 'X', ageGroup: 'toddler' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_AGE_GROUP');
  });

  test('creates a profile with pace, preferences, and constraint fields', async () => {
    const agent = await agentFor();

    const res = await agent.post('/api/traveler-profiles').send({
      profileName: 'My Partner',
      pace: 'intensive',
      preferences: { museums: 'interested', nightlife: 'block' },
      foodCuisineInterests: 'Italian, Thai',
      dietaryRestrictions: ['nuts', 'vegan'],
      dietaryRequirements: 'Vegetarian',
      indoorOutdoorTendency: 'outdoor',
      walkingTolerance: 'high',
      hardConstraints: 'Wheelchair access required',
      travelStyleNote: 'Loves early mornings',
    });

    expect(res.status).toBe(201);
    expect(res.body.profile).toMatchObject({
      pace: 'intensive',
      preferences: { museums: 'interested', nightlife: 'block' },
      foodCuisineInterests: 'Italian, Thai',
      dietaryRestrictions: ['nuts', 'vegan'],
      dietaryRequirements: 'Vegetarian',
      indoorOutdoorTendency: 'outdoor',
      walkingTolerance: 'high',
      hardConstraints: 'Wheelchair access required',
      travelStyleNote: 'Loves early mornings',
    });
  });

  test('rejects an unrecognized dietaryRestrictions value', async () => {
    const agent = await agentFor();

    const res = await agent
      .post('/api/traveler-profiles')
      .send({ profileName: 'X', dietaryRestrictions: ['nuts', 'spicy'] });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_DIETARY_RESTRICTIONS');
  });

  test('defaults unset preference categories to neutral once preferences is supplied', async () => {
    const agent = await agentFor();

    const res = await agent
      .post('/api/traveler-profiles')
      .send({ profileName: 'X', preferences: { museums: 'interested' } });

    expect(res.status).toBe(201);
    expect(res.body.profile.preferences.museums).toBe('interested');
    expect(res.body.profile.preferences.food).toBe('neutral');
  });

  test('rejects an unrecognized pace', async () => {
    const agent = await agentFor();

    const res = await agent
      .post('/api/traveler-profiles')
      .send({ profileName: 'X', pace: 'frantic' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_PACE');
  });

  test('rejects an unknown preference category', async () => {
    const agent = await agentFor();

    const res = await agent
      .post('/api/traveler-profiles')
      .send({ profileName: 'X', preferences: { skydiving: 'interested' } });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_PREFERENCES');
  });

  test('rejects an invalid preference value', async () => {
    const agent = await agentFor();

    const res = await agent
      .post('/api/traveler-profiles')
      .send({ profileName: 'X', preferences: { museums: 'love-it' } });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_PREFERENCES');
  });

  test('rejects hard constraints text over the length limit', async () => {
    const agent = await agentFor();

    const res = await agent
      .post('/api/traveler-profiles')
      .send({ profileName: 'X', hardConstraints: 'a'.repeat(501) });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_HARD_CONSTRAINTS');
  });

  test('rejects unauthenticated requests', async () => {
    const res = await request(app)
      .post('/api/traveler-profiles')
      .send({ profileName: 'My Partner' });

    expect(res.status).toBe(401);
  });
});

describe('GET /api/traveler-profiles', () => {
  test('lists only the caller’s own profiles, most recent first', async () => {
    const agent = await agentFor('owner@example.com');
    await agent.post('/api/traveler-profiles').send({ profileName: 'First' });
    await agent.post('/api/traveler-profiles').send({ profileName: 'Second' });

    const otherAgent = await agentFor('other@example.com');
    await otherAgent.post('/api/traveler-profiles').send({ profileName: 'Not Mine' });

    const res = await agent.get('/api/traveler-profiles');

    expect(res.status).toBe(200);
    expect(res.body.profiles.map((p) => p.profileName)).toEqual(['Second', 'First']);
  });
});

describe('GET /api/traveler-profiles/:id', () => {
  test('returns the profile for its owner', async () => {
    const agent = await agentFor();
    const created = await agent.post('/api/traveler-profiles').send({ profileName: 'My Partner' });

    const res = await agent.get(`/api/traveler-profiles/${created.body.profile.id}`);

    expect(res.status).toBe(200);
    expect(res.body.profile.id).toBe(created.body.profile.id);
  });

  test('returns 404 for a profile owned by someone else', async () => {
    const owner = await agentFor('owner2@example.com');
    const created = await owner.post('/api/traveler-profiles').send({ profileName: 'Owner Only' });

    const stranger = await agentFor('stranger@example.com');
    const res = await stranger.get(`/api/traveler-profiles/${created.body.profile.id}`);

    expect(res.status).toBe(404);
  });

  test('returns 404 for a nonexistent id', async () => {
    const agent = await agentFor();
    const res = await agent.get(`/api/traveler-profiles/${new mongoose.Types.ObjectId()}`);

    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/traveler-profiles/:id', () => {
  test('updates the supplied fields and leaves the rest untouched', async () => {
    const agent = await agentFor();
    const created = await agent
      .post('/api/traveler-profiles')
      .send({ profileName: 'My Partner' });

    const res = await agent
      .patch(`/api/traveler-profiles/${created.body.profile.id}`)
      .send({ ageGroup: 'senior' });

    expect(res.status).toBe(200);
    expect(res.body.profile).toMatchObject({
      profileName: 'My Partner',
      ageGroup: 'senior',
    });
  });

  test('clears an optional field when sent as an empty string', async () => {
    const agent = await agentFor();
    const created = await agent
      .post('/api/traveler-profiles')
      .send({ profileName: 'My Partner', pace: 'balanced' });

    const res = await agent
      .patch(`/api/traveler-profiles/${created.body.profile.id}`)
      .send({ pace: '' });

    expect(res.status).toBe(200);
    expect(res.body.profile.pace).toBeUndefined();
  });

  test('updates preferences without touching other saved fields', async () => {
    const agent = await agentFor();
    const created = await agent.post('/api/traveler-profiles').send({
      profileName: 'My Partner',
      pace: 'relaxed',
      preferences: { museums: 'interested' },
    });

    const res = await agent
      .patch(`/api/traveler-profiles/${created.body.profile.id}`)
      .send({ preferences: { museums: 'avoid', nightlife: 'block' } });

    expect(res.status).toBe(200);
    expect(res.body.profile.pace).toBe('relaxed');
    expect(res.body.profile.preferences).toMatchObject({ museums: 'avoid', nightlife: 'block' });
  });

  test('clears pace when sent as an empty string', async () => {
    const agent = await agentFor();
    const created = await agent
      .post('/api/traveler-profiles')
      .send({ profileName: 'My Partner', pace: 'balanced' });

    const res = await agent
      .patch(`/api/traveler-profiles/${created.body.profile.id}`)
      .send({ pace: '' });

    expect(res.status).toBe(200);
    expect(res.body.profile.pace).toBeUndefined();
  });

  test('rejects clearing the required profileName', async () => {
    const agent = await agentFor();
    const created = await agent.post('/api/traveler-profiles').send({ profileName: 'My Partner' });

    const res = await agent
      .patch(`/api/traveler-profiles/${created.body.profile.id}`)
      .send({ profileName: '' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_PROFILE_NAME');
  });

  test('returns 404 when updating a non-owned profile', async () => {
    const owner = await agentFor('owner3@example.com');
    const created = await owner.post('/api/traveler-profiles').send({ profileName: 'Owner Only' });

    const stranger = await agentFor('stranger2@example.com');
    const res = await stranger
      .patch(`/api/traveler-profiles/${created.body.profile.id}`)
      .send({ profileName: 'Hijacked' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/traveler-profiles/:id', () => {
  test('deletes the caller’s own profile', async () => {
    const agent = await agentFor();
    const created = await agent.post('/api/traveler-profiles').send({ profileName: 'My Partner' });

    const res = await agent.delete(`/api/traveler-profiles/${created.body.profile.id}`);
    expect(res.status).toBe(204);

    const getRes = await agent.get(`/api/traveler-profiles/${created.body.profile.id}`);
    expect(getRes.status).toBe(404);
  });

  test('returns 404 when deleting a non-owned profile, and it survives', async () => {
    const owner = await agentFor('owner4@example.com');
    const created = await owner.post('/api/traveler-profiles').send({ profileName: 'Owner Only' });

    const stranger = await agentFor('stranger3@example.com');
    const res = await stranger.delete(`/api/traveler-profiles/${created.body.profile.id}`);
    expect(res.status).toBe(404);

    const stillThere = await owner.get(`/api/traveler-profiles/${created.body.profile.id}`);
    expect(stillThere.status).toBe(200);
  });
});
