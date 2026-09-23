import { describe, test, expect, beforeAll, afterEach, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../../src/app.js';
import { User } from '../../src/modules/auth/user.model.js';
import { Trip } from '../../src/modules/trips/trip.model.js';
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
  await Trip.deleteMany({});
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

describe('POST /api/trips', () => {
  test('creates an empty DRAFT trip with wizardStep 1', async () => {
    const agent = await agentFor();

    const res = await agent.post('/api/trips').send({});

    expect(res.status).toBe(201);
    expect(res.body.trip).toMatchObject({
      id: expect.any(String),
      status: 'DRAFT',
      wizardStep: 1,
    });
    expect(res.body.trip.destination).toBeUndefined();
  });

  test('creates a trip with destination, dates, and title', async () => {
    const agent = await agentFor();

    const res = await agent.post('/api/trips').send({
      destination: 'Lisbon',
      startDate: '2026-09-01',
      endDate: '2026-09-05',
      tripTitle: 'Autumn Trip',
    });

    expect(res.status).toBe(201);
    expect(res.body.trip).toMatchObject({
      destination: 'Lisbon',
      tripTitle: 'Autumn Trip',
      duration: 5,
    });
  });

  test('rejects an end date before the start date', async () => {
    const agent = await agentFor();

    const res = await agent.post('/api/trips').send({
      destination: 'Lisbon',
      startDate: '2026-09-05',
      endDate: '2026-09-01',
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_DATE_RANGE');
  });

  test('rejects an invalid start date', async () => {
    const agent = await agentFor();

    const res = await agent.post('/api/trips').send({ startDate: 'not-a-date' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_START_DATE');
  });

  test('rejects a destination over the length limit', async () => {
    const agent = await agentFor();

    const res = await agent.post('/api/trips').send({ destination: 'a'.repeat(201) });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_DESTINATION');
  });

  test('rejects creating a trip with wizardStep past basics but no destination/dates', async () => {
    const agent = await agentFor();

    const res = await agent.post('/api/trips').send({ wizardStep: 2 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INCOMPLETE_TRIP_BASICS');
  });

  test('rejects unauthenticated requests', async () => {
    const res = await request(app).post('/api/trips').send({});
    expect(res.status).toBe(401);
  });
});

describe('GET /api/trips', () => {
  test('lists only the caller’s own trips, most recent first', async () => {
    const agent = await agentFor('owner@example.com');
    await agent.post('/api/trips').send({ destination: 'First' });
    await agent.post('/api/trips').send({ destination: 'Second' });

    const otherAgent = await agentFor('other@example.com');
    await otherAgent.post('/api/trips').send({ destination: 'Not Mine' });

    const res = await agent.get('/api/trips');

    expect(res.status).toBe(200);
    expect(res.body.trips.map((t) => t.destination)).toEqual(['Second', 'First']);
  });
});

describe('GET /api/trips/:id', () => {
  test('returns the trip for its owner', async () => {
    const agent = await agentFor();
    const created = await agent.post('/api/trips').send({ destination: 'Lisbon' });

    const res = await agent.get(`/api/trips/${created.body.trip.id}`);

    expect(res.status).toBe(200);
    expect(res.body.trip.id).toBe(created.body.trip.id);
  });

  test('returns 404 for a trip owned by someone else', async () => {
    const owner = await agentFor('owner2@example.com');
    const created = await owner.post('/api/trips').send({ destination: 'Owner Only' });

    const stranger = await agentFor('stranger@example.com');
    const res = await stranger.get(`/api/trips/${created.body.trip.id}`);

    expect(res.status).toBe(404);
  });

  test('returns 404 for a nonexistent id', async () => {
    const agent = await agentFor();
    const res = await agent.get(`/api/trips/${new mongoose.Types.ObjectId()}`);

    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/trips/:id', () => {
  test('persists a completed wizard step incrementally', async () => {
    const agent = await agentFor();
    const created = await agent.post('/api/trips').send({});

    const res = await agent.patch(`/api/trips/${created.body.trip.id}`).send({
      destination: 'Lisbon',
      startDate: '2026-09-01',
      endDate: '2026-09-05',
      wizardStep: 2,
    });

    expect(res.status).toBe(200);
    expect(res.body.trip).toMatchObject({
      destination: 'Lisbon',
      wizardStep: 2,
      duration: 5,
    });
  });

  test('resumes with previously persisted data and wizardStep on reload', async () => {
    const agent = await agentFor();
    const created = await agent.post('/api/trips').send({});
    await agent.patch(`/api/trips/${created.body.trip.id}`).send({
      destination: 'Lisbon',
      startDate: '2026-09-01',
      endDate: '2026-09-05',
      wizardStep: 2,
    });

    const res = await agent.get(`/api/trips/${created.body.trip.id}`);

    expect(res.status).toBe(200);
    expect(res.body.trip).toMatchObject({ destination: 'Lisbon', wizardStep: 2 });
  });

  test('rejects an update that creates an invalid date range using existing data', async () => {
    const agent = await agentFor();
    const created = await agent.post('/api/trips').send({ startDate: '2026-09-05' });

    const res = await agent
      .patch(`/api/trips/${created.body.trip.id}`)
      .send({ endDate: '2026-09-01' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_DATE_RANGE');
  });

  test('rejects advancing wizardStep past basics without destination/dates set', async () => {
    const agent = await agentFor();
    const created = await agent.post('/api/trips').send({});

    const res = await agent.patch(`/api/trips/${created.body.trip.id}`).send({ wizardStep: 2 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INCOMPLETE_TRIP_BASICS');
  });

  test('rejects advancing wizardStep when clearing destination in the same update', async () => {
    const agent = await agentFor();
    const created = await agent.post('/api/trips').send({
      destination: 'Lisbon',
      startDate: '2026-09-01',
      endDate: '2026-09-05',
    });

    const res = await agent
      .patch(`/api/trips/${created.body.trip.id}`)
      .send({ destination: '', wizardStep: 2 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INCOMPLETE_TRIP_BASICS');
  });

  test('clears destination when sent as an empty string', async () => {
    const agent = await agentFor();
    const created = await agent.post('/api/trips').send({ destination: 'Lisbon' });

    const res = await agent.patch(`/api/trips/${created.body.trip.id}`).send({ destination: '' });

    expect(res.status).toBe(200);
    expect(res.body.trip.destination).toBeUndefined();
  });

  test('returns 404 when updating a non-owned trip', async () => {
    const owner = await agentFor('owner3@example.com');
    const created = await owner.post('/api/trips').send({ destination: 'Owner Only' });

    const stranger = await agentFor('stranger2@example.com');
    const res = await stranger
      .patch(`/api/trips/${created.body.trip.id}`)
      .send({ destination: 'Hijacked' });

    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/trips/:id — trip travelers (F07)', () => {
  test('attaches a reusable profile as a frozen snapshot', async () => {
    const agent = await agentFor();
    const profileRes = await agent.post('/api/traveler-profiles').send({
      profileName: 'Sam',
      ageGroup: 'adult',
      pace: 'balanced',
    });
    const created = await agent.post('/api/trips').send({});

    const res = await agent
      .patch(`/api/trips/${created.body.trip.id}`)
      .send({ addTravelerProfileId: profileRes.body.profile.id });

    expect(res.status).toBe(200);
    expect(res.body.trip.tripProfile.travelers).toHaveLength(1);
    expect(res.body.trip.tripProfile.travelers[0]).toMatchObject({
      sourceTravelerProfileId: profileRes.body.profile.id,
      travelerName: 'Sam',
      ageGroup: 'adult',
      pace: 'balanced',
    });
  });

  test('rejects attaching the same profile twice', async () => {
    const agent = await agentFor();
    const profileRes = await agent.post('/api/traveler-profiles').send({ profileName: 'Solo' });
    const created = await agent.post('/api/trips').send({});
    await agent
      .patch(`/api/trips/${created.body.trip.id}`)
      .send({ addTravelerProfileId: profileRes.body.profile.id });

    const res = await agent
      .patch(`/api/trips/${created.body.trip.id}`)
      .send({ addTravelerProfileId: profileRes.body.profile.id });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('DUPLICATE_TRIP_TRAVELER');
  });

  test('rejects attaching a profile owned by someone else', async () => {
    const stranger = await agentFor('stranger4@example.com');
    const strangerProfile = await stranger
      .post('/api/traveler-profiles')
      .send({ profileName: 'Not Yours' });

    const agent = await agentFor();
    const created = await agent.post('/api/trips').send({});

    const res = await agent
      .patch(`/api/trips/${created.body.trip.id}`)
      .send({ addTravelerProfileId: strangerProfile.body.profile.id });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('TRAVELER_PROFILE_NOT_FOUND');

    const stillEmpty = await agent.get(`/api/trips/${created.body.trip.id}`);
    expect(stillEmpty.body.trip.tripProfile.travelers).toHaveLength(0);
  });

  test('rejects attaching a nonexistent profile id', async () => {
    const agent = await agentFor();
    const created = await agent.post('/api/trips').send({});

    const res = await agent
      .patch(`/api/trips/${created.body.trip.id}`)
      .send({ addTravelerProfileId: new mongoose.Types.ObjectId().toString() });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('TRAVELER_PROFILE_NOT_FOUND');
  });

  test('removes a trip traveler by its snapshot id', async () => {
    const agent = await agentFor();
    const profileRes = await agent.post('/api/traveler-profiles').send({ profileName: 'Solo' });
    const created = await agent.post('/api/trips').send({});
    const attached = await agent
      .patch(`/api/trips/${created.body.trip.id}`)
      .send({ addTravelerProfileId: profileRes.body.profile.id });
    const tripTravelerId = attached.body.trip.tripProfile.travelers[0].id;

    const res = await agent
      .patch(`/api/trips/${created.body.trip.id}`)
      .send({ removeTravelerId: tripTravelerId });

    expect(res.status).toBe(200);
    expect(res.body.trip.tripProfile.travelers).toHaveLength(0);
  });

  test('returns 404 removing an unknown trip traveler id', async () => {
    const agent = await agentFor();
    const created = await agent.post('/api/trips').send({});

    const res = await agent
      .patch(`/api/trips/${created.body.trip.id}`)
      .send({ removeTravelerId: new mongoose.Types.ObjectId().toString() });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('TRIP_TRAVELER_NOT_FOUND');
  });

  test('editing the reusable profile after attach does not change the trip snapshot', async () => {
    const agent = await agentFor();
    const profileRes = await agent
      .post('/api/traveler-profiles')
      .send({ profileName: 'Sam' });
    const created = await agent.post('/api/trips').send({});
    await agent
      .patch(`/api/trips/${created.body.trip.id}`)
      .send({ addTravelerProfileId: profileRes.body.profile.id });

    await agent
      .patch(`/api/traveler-profiles/${profileRes.body.profile.id}`)
      .send({ profileName: 'Changed' });

    const res = await agent.get(`/api/trips/${created.body.trip.id}`);
    expect(res.body.trip.tripProfile.travelers[0].travelerName).toBe('Sam');
  });

  test('deleting the reusable profile does not break or alter the trip', async () => {
    const agent = await agentFor();
    const profileRes = await agent
      .post('/api/traveler-profiles')
      .send({ profileName: 'Sam' });
    const created = await agent.post('/api/trips').send({});
    await agent
      .patch(`/api/trips/${created.body.trip.id}`)
      .send({ addTravelerProfileId: profileRes.body.profile.id });

    await agent.delete(`/api/traveler-profiles/${profileRes.body.profile.id}`);

    const res = await agent.get(`/api/trips/${created.body.trip.id}`);
    expect(res.status).toBe(200);
    expect(res.body.trip.tripProfile.travelers[0]).toMatchObject({
      travelerName: 'Sam',
      sourceTravelerProfileId: profileRes.body.profile.id,
    });
  });
});

describe('PATCH /api/trips/:id — trip-only travelers & children (F08)', () => {
  test('adds a trip-only traveler with no source profile', async () => {
    const agent = await agentFor();
    const created = await agent.post('/api/trips').send({});

    const res = await agent.patch(`/api/trips/${created.body.trip.id}`).send({
      addTripOnlyTraveler: { travelerName: 'Cousin Alex', ageGroup: 'adult', pace: 'relaxed' },
    });

    expect(res.status).toBe(200);
    expect(res.body.trip.tripProfile.travelers).toHaveLength(1);
    expect(res.body.trip.tripProfile.travelers[0]).toMatchObject({
      travelerName: 'Cousin Alex',
      ageGroup: 'adult',
      pace: 'relaxed',
    });
    expect(res.body.trip.tripProfile.travelers[0].sourceTravelerProfileId).toBeUndefined();
  });

  test('rejects a trip-only traveler without a name', async () => {
    const agent = await agentFor();
    const created = await agent.post('/api/trips').send({});

    const res = await agent
      .patch(`/api/trips/${created.body.trip.id}`)
      .send({ addTripOnlyTraveler: { ageGroup: 'adult' } });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_TRAVELER_NAME');
  });

  test('combines a reusable-profile traveler and a trip-only traveler, and removes either by id', async () => {
    const agent = await agentFor();
    const profileRes = await agent.post('/api/traveler-profiles').send({ profileName: 'Partner' });
    const created = await agent.post('/api/trips').send({});
    await agent
      .patch(`/api/trips/${created.body.trip.id}`)
      .send({ addTravelerProfileId: profileRes.body.profile.id });
    const withBoth = await agent
      .patch(`/api/trips/${created.body.trip.id}`)
      .send({ addTripOnlyTraveler: { travelerName: 'Cousin Alex' } });

    expect(withBoth.body.trip.tripProfile.travelers).toHaveLength(2);

    const tripOnlyId = withBoth.body.trip.tripProfile.travelers.find(
      (traveler) => traveler.travelerName === 'Cousin Alex',
    ).id;
    const res = await agent
      .patch(`/api/trips/${created.body.trip.id}`)
      .send({ removeTravelerId: tripOnlyId });

    expect(res.status).toBe(200);
    expect(res.body.trip.tripProfile.travelers).toHaveLength(1);
    expect(res.body.trip.tripProfile.travelers[0].travelerName).not.toBe('Cousin Alex');
  });

  test('adds and removes children, with childCount always derived', async () => {
    const agent = await agentFor();
    const created = await agent.post('/api/trips').send({});

    const withOne = await agent
      .patch(`/api/trips/${created.body.trip.id}`)
      .send({ addChildAge: 6 });
    expect(withOne.status).toBe(200);
    expect(withOne.body.trip.tripProfile.children).toHaveLength(1);
    expect(withOne.body.trip.tripProfile.children[0].age).toBe(6);
    expect(withOne.body.trip.tripProfile.childCount).toBe(1);

    const withTwo = await agent
      .patch(`/api/trips/${created.body.trip.id}`)
      .send({ addChildAge: 1 });
    expect(withTwo.body.trip.tripProfile.childCount).toBe(2);

    const childId = withTwo.body.trip.tripProfile.children[0].id;
    const res = await agent
      .patch(`/api/trips/${created.body.trip.id}`)
      .send({ removeChildId: childId });

    expect(res.status).toBe(200);
    expect(res.body.trip.tripProfile.children).toHaveLength(1);
    expect(res.body.trip.tripProfile.childCount).toBe(1);
  });

  test('rejects an invalid child age', async () => {
    const agent = await agentFor();
    const created = await agent.post('/api/trips').send({});

    const res = await agent.patch(`/api/trips/${created.body.trip.id}`).send({ addChildAge: 25 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_CHILD_AGE');
  });

  test('returns 404 removing an unknown child id', async () => {
    const agent = await agentFor();
    const created = await agent.post('/api/trips').send({});

    const res = await agent
      .patch(`/api/trips/${created.body.trip.id}`)
      .send({ removeChildId: new mongoose.Types.ObjectId().toString() });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('CHILD_NOT_FOUND');
  });

  test('does not create a User account or TravelerProfile for trip-only travelers or children', async () => {
    const agent = await agentFor();
    const created = await agent.post('/api/trips').send({});

    await agent.patch(`/api/trips/${created.body.trip.id}`).send({
      addTripOnlyTraveler: { travelerName: 'Cousin Alex' },
    });
    await agent.patch(`/api/trips/${created.body.trip.id}`).send({ addChildAge: 6 });

    expect(await TravelerProfile.countDocuments({})).toBe(0);
    expect(await User.countDocuments({})).toBe(1);
  });
});

describe('PATCH /api/trips/:id — questionnaire & trip overrides (F09)', () => {
  test('sets accommodation, budget, pace override, preferences, hard constraints, mustDo, and notes', async () => {
    const agent = await agentFor();
    const created = await agent.post('/api/trips').send({});

    const res = await agent.patch(`/api/trips/${created.body.trip.id}`).send({
      accommodation: { hotelBooked: true, hotelName: 'Grand Hotel', hotelArea: 'Downtown' },
      budgetLevel: 'moderate',
      paceOverride: 'intensive',
      preferences: { museums: 'interested', nightlife: 'block' },
      hardConstraints: 'Wheelchair accessible only.',
      mustDo: ['Eiffel Tower', 'Louvre'],
      notes: 'Anniversary trip.',
    });

    expect(res.status).toBe(200);
    expect(res.body.trip.tripProfile).toMatchObject({
      accommodation: { hotelBooked: true, hotelName: 'Grand Hotel', hotelArea: 'Downtown' },
      budgetLevel: 'moderate',
      paceOverride: 'intensive',
      preferences: { museums: 'interested', nightlife: 'block' },
      hardConstraints: 'Wheelchair accessible only.',
      mustDo: ['Eiffel Tower', 'Louvre'],
      notes: 'Anniversary trip.',
    });
  });

  test('allows hotelBooked: false with only an optional preferred area', async () => {
    const agent = await agentFor();
    const created = await agent.post('/api/trips').send({});

    const res = await agent.patch(`/api/trips/${created.body.trip.id}`).send({
      accommodation: { hotelBooked: false, hotelArea: 'Near the beach' },
    });

    expect(res.status).toBe(200);
    expect(res.body.trip.tripProfile.accommodation).toMatchObject({
      hotelBooked: false,
      hotelArea: 'Near the beach',
    });
    expect(res.body.trip.tripProfile.accommodation.hotelName).toBeUndefined();
  });

  test('rejects hotelBooked: true without a hotel name', async () => {
    const agent = await agentFor();
    const created = await agent.post('/api/trips').send({});

    const res = await agent
      .patch(`/api/trips/${created.body.trip.id}`)
      .send({ accommodation: { hotelBooked: true } });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('HOTEL_NAME_REQUIRED');
  });

  test('rejects hotelBooked: true if hotel name is cleared in a later update', async () => {
    const agent = await agentFor();
    const created = await agent.post('/api/trips').send({});
    await agent.patch(`/api/trips/${created.body.trip.id}`).send({
      accommodation: { hotelBooked: true, hotelName: 'Grand Hotel' },
    });

    const res = await agent
      .patch(`/api/trips/${created.body.trip.id}`)
      .send({ accommodation: { hotelName: '' } });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('HOTEL_NAME_REQUIRED');
  });

  test('rejects accommodation: null with a validation error instead of crashing', async () => {
    const agent = await agentFor();
    const created = await agent.post('/api/trips').send({});

    const res = await agent
      .patch(`/api/trips/${created.body.trip.id}`)
      .send({ accommodation: null });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_ACCOMMODATION');
  });

  test('rejects a non-boolean hotelBooked value instead of silently coercing it', async () => {
    const agent = await agentFor();
    const created = await agent.post('/api/trips').send({});

    const res = await agent
      .patch(`/api/trips/${created.body.trip.id}`)
      .send({ accommodation: { hotelBooked: 'false' } });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_HOTEL_BOOKED');
  });

  test('clears hotelBooked back to unset when sent as null', async () => {
    const agent = await agentFor();
    const created = await agent.post('/api/trips').send({});
    await agent.patch(`/api/trips/${created.body.trip.id}`).send({
      accommodation: { hotelBooked: false, hotelArea: 'Old Town' },
    });

    const res = await agent
      .patch(`/api/trips/${created.body.trip.id}`)
      .send({ accommodation: { hotelBooked: null } });

    expect(res.status).toBe(200);
    expect(res.body.trip.tripProfile.accommodation.hotelBooked).toBeUndefined();
    expect(res.body.trip.tripProfile.accommodation.hotelArea).toBe('Old Town');
  });

  test('rejects an unrecognized budget level', async () => {
    const agent = await agentFor();
    const created = await agent.post('/api/trips').send({});

    const res = await agent
      .patch(`/api/trips/${created.body.trip.id}`)
      .send({ budgetLevel: 'luxury' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_BUDGET_LEVEL');
  });

  test('rejects an unrecognized pace override', async () => {
    const agent = await agentFor();
    const created = await agent.post('/api/trips').send({});

    const res = await agent
      .patch(`/api/trips/${created.body.trip.id}`)
      .send({ paceOverride: 'extreme' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_PACE_OVERRIDE');
  });

  test('rejects hard constraints text over the length limit', async () => {
    const agent = await agentFor();
    const created = await agent.post('/api/trips').send({});

    const res = await agent
      .patch(`/api/trips/${created.body.trip.id}`)
      .send({ hardConstraints: 'a'.repeat(501) });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_HARD_CONSTRAINTS');
  });

  test('rejects notes text over the length limit', async () => {
    const agent = await agentFor();
    const created = await agent.post('/api/trips').send({});

    const res = await agent
      .patch(`/api/trips/${created.body.trip.id}`)
      .send({ notes: 'a'.repeat(1001) });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_NOTES');
  });

  test('rejects too many mustDo items', async () => {
    const agent = await agentFor();
    const created = await agent.post('/api/trips').send({});

    const res = await agent
      .patch(`/api/trips/${created.body.trip.id}`)
      .send({ mustDo: Array.from({ length: 21 }, (_, i) => `Item ${i}`) });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_MUST_DO');
  });

  test('rejects a blank mustDo item', async () => {
    const agent = await agentFor();
    const created = await agent.post('/api/trips').send({});

    const res = await agent
      .patch(`/api/trips/${created.body.trip.id}`)
      .send({ mustDo: ['Eiffel Tower', '   '] });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_MUST_DO');
  });

  test('rejects an unknown preference category', async () => {
    const agent = await agentFor();
    const created = await agent.post('/api/trips').send({});

    const res = await agent
      .patch(`/api/trips/${created.body.trip.id}`)
      .send({ preferences: { skydiving: 'interested' } });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_PREFERENCES');
  });

  test('questionnaire fields persist and reload correctly', async () => {
    const agent = await agentFor();
    const created = await agent.post('/api/trips').send({});
    await agent.patch(`/api/trips/${created.body.trip.id}`).send({
      accommodation: { hotelBooked: false, hotelArea: 'Old Town' },
      budgetLevel: 'budget',
      mustDo: ['Local market'],
    });

    const res = await agent.get(`/api/trips/${created.body.trip.id}`);

    expect(res.status).toBe(200);
    expect(res.body.trip.tripProfile).toMatchObject({
      accommodation: { hotelBooked: false, hotelArea: 'Old Town' },
      budgetLevel: 'budget',
      mustDo: ['Local market'],
    });
  });

  test('trip overrides never create or mutate a reusable TravelerProfile', async () => {
    const agent = await agentFor();
    const profileRes = await agent.post('/api/traveler-profiles').send({
      profileName: 'Me',
      pace: 'relaxed',
      preferences: { museums: 'neutral' },
    });
    const created = await agent.post('/api/trips').send({});
    await agent.patch(`/api/trips/${created.body.trip.id}`).send({
      addTravelerProfileId: profileRes.body.profile.id,
      paceOverride: 'intensive',
      preferences: { museums: 'block' },
    });

    const profileAfter = await agent.get(`/api/traveler-profiles/${profileRes.body.profile.id}`);
    expect(profileAfter.body.profile.pace).toBe('relaxed');
    expect(profileAfter.body.profile.preferences.museums).toBe('neutral');
  });

  test('returns 404 updating questionnaire fields on a non-owned trip', async () => {
    const owner = await agentFor('owner5@example.com');
    const created = await owner.post('/api/trips').send({});

    const stranger = await agentFor('stranger5@example.com');
    const res = await stranger
      .patch(`/api/trips/${created.body.trip.id}`)
      .send({ budgetLevel: 'premium' });

    expect(res.status).toBe(404);
  });
});

// Builds a trip with basics, one trip-only traveler, and the questionnaire
// step completed — the minimum state assertTripReadyForGeneration accepts.
async function buildReadyTrip(agent) {
  const created = await agent.post('/api/trips').send({
    destination: 'Lisbon',
    startDate: '2027-05-01',
    endDate: '2027-05-05',
    wizardStep: 2,
  });
  const tripId = created.body.trip.id;
  await agent
    .patch(`/api/trips/${tripId}`)
    .send({ addTripOnlyTraveler: { travelerName: 'Sam' }, wizardStep: 3 });
  await agent.patch(`/api/trips/${tripId}`).send({ wizardStep: 4 });
  return tripId;
}

describe('PATCH /api/trips/:id — review & readiness (F10)', () => {
  test('marks a complete trip READY_FOR_GENERATION without touching status otherwise', async () => {
    const agent = await agentFor();
    const tripId = await buildReadyTrip(agent);

    const res = await agent.patch(`/api/trips/${tripId}`).send({ markReadyForGeneration: true });

    expect(res.status).toBe(200);
    expect(res.body.trip.status).toBe('READY_FOR_GENERATION');
  });

  test('rejects marking ready before basics are complete', async () => {
    const agent = await agentFor();
    const created = await agent.post('/api/trips').send({});

    const res = await agent
      .patch(`/api/trips/${created.body.trip.id}`)
      .send({ markReadyForGeneration: true });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('TRIP_NOT_READY');
  });

  test('rejects marking ready without at least one traveler', async () => {
    const agent = await agentFor();
    const created = await agent.post('/api/trips').send({
      destination: 'Lisbon',
      startDate: '2027-05-01',
      endDate: '2027-05-05',
      wizardStep: 4,
    });

    const res = await agent
      .patch(`/api/trips/${created.body.trip.id}`)
      .send({ markReadyForGeneration: true });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('TRIP_NOT_READY');
  });

  test('rejects marking ready before the questionnaire step is reached', async () => {
    const agent = await agentFor();
    const created = await agent.post('/api/trips').send({
      destination: 'Lisbon',
      startDate: '2027-05-01',
      endDate: '2027-05-05',
      wizardStep: 2,
    });
    await agent
      .patch(`/api/trips/${created.body.trip.id}`)
      .send({ addTripOnlyTraveler: { travelerName: 'Sam' } });

    const res = await agent
      .patch(`/api/trips/${created.body.trip.id}`)
      .send({ markReadyForGeneration: true });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('TRIP_NOT_READY');
  });

  test('a material edit after marking ready reverts status to DRAFT', async () => {
    const agent = await agentFor();
    const tripId = await buildReadyTrip(agent);
    await agent.patch(`/api/trips/${tripId}`).send({ markReadyForGeneration: true });

    const res = await agent.patch(`/api/trips/${tripId}`).send({ mustDo: ['Local market'] });

    expect(res.status).toBe(200);
    expect(res.body.trip.status).toBe('DRAFT');
  });

  test('a non-material edit after marking ready leaves status untouched', async () => {
    const agent = await agentFor();
    const tripId = await buildReadyTrip(agent);
    await agent.patch(`/api/trips/${tripId}`).send({ markReadyForGeneration: true });

    const res = await agent.patch(`/api/trips/${tripId}`).send({ tripTitle: 'Spring in Lisbon' });

    expect(res.status).toBe(200);
    expect(res.body.trip.status).toBe('READY_FOR_GENERATION');
  });

  test('resending unchanged dates/mustDo alongside a tripTitle edit does not revert a ready trip', async () => {
    // The basics edit form and the questionnaire form each resend their
    // whole section together, including fields the user didn't touch —
    // "supplied" must not be conflated with "changed" for materiality.
    const agent = await agentFor();
    const tripId = await buildReadyTrip(agent);
    await agent.patch(`/api/trips/${tripId}`).send({ mustDo: ['Local market'] });
    const beforeRes = await agent.get(`/api/trips/${tripId}`);
    await agent.patch(`/api/trips/${tripId}`).send({ markReadyForGeneration: true });

    const res = await agent.patch(`/api/trips/${tripId}`).send({
      destination: beforeRes.body.trip.destination,
      startDate: beforeRes.body.trip.startDate,
      endDate: beforeRes.body.trip.endDate,
      tripTitle: 'Spring in Lisbon',
      mustDo: beforeRes.body.trip.tripProfile.mustDo,
    });

    expect(res.status).toBe(200);
    expect(res.body.trip.status).toBe('READY_FOR_GENERATION');
  });

  test('changing the destination after marking ready reverts status to DRAFT', async () => {
    const agent = await agentFor();
    const tripId = await buildReadyTrip(agent);
    await agent.patch(`/api/trips/${tripId}`).send({ markReadyForGeneration: true });

    const res = await agent.patch(`/api/trips/${tripId}`).send({ destination: 'Porto' });

    expect(res.status).toBe(200);
    expect(res.body.trip.status).toBe('DRAFT');
  });

  test('rejects marking an already-ready trip ready again', async () => {
    const agent = await agentFor();
    const tripId = await buildReadyTrip(agent);
    await agent.patch(`/api/trips/${tripId}`).send({ markReadyForGeneration: true });

    const res = await agent.patch(`/api/trips/${tripId}`).send({ markReadyForGeneration: true });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('TRIP_NOT_DRAFT');
  });

  test('returns 404 marking a non-owned trip ready', async () => {
    const owner = await agentFor('owner6@example.com');
    const tripId = await buildReadyTrip(owner);

    const stranger = await agentFor('stranger6@example.com');
    const res = await stranger.patch(`/api/trips/${tripId}`).send({ markReadyForGeneration: true });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/trips/:id', () => {
  test('deletes the caller’s own trip', async () => {
    const agent = await agentFor();
    const created = await agent.post('/api/trips').send({ destination: 'Lisbon' });

    const res = await agent.delete(`/api/trips/${created.body.trip.id}`);
    expect(res.status).toBe(204);

    const getRes = await agent.get(`/api/trips/${created.body.trip.id}`);
    expect(getRes.status).toBe(404);
  });

  test('returns 404 when deleting a non-owned trip, and it survives', async () => {
    const owner = await agentFor('owner4@example.com');
    const created = await owner.post('/api/trips').send({ destination: 'Owner Only' });

    const stranger = await agentFor('stranger3@example.com');
    const res = await stranger.delete(`/api/trips/${created.body.trip.id}`);
    expect(res.status).toBe(404);

    const stillThere = await owner.get(`/api/trips/${created.body.trip.id}`);
    expect(stillThere.status).toBe(200);
  });

  test('rejects deletion while an AI operation is in progress', async () => {
    const agent = await agentFor();
    const created = await agent.post('/api/trips').send({ destination: 'Lisbon' });
    await Trip.findByIdAndUpdate(created.body.trip.id, { status: 'GENERATING', startedAt: new Date() });

    const res = await agent.delete(`/api/trips/${created.body.trip.id}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('TRIP_DELETE_IN_PROGRESS');

    const stillThere = await agent.get(`/api/trips/${created.body.trip.id}`);
    expect(stillThere.status).toBe(200);
  });
});
