import { describe, test, expect, beforeAll, afterEach, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../../src/app.js';
import { User } from '../../src/modules/auth/user.model.js';
import { Trip } from '../../src/modules/trips/trip.model.js';
import { createFakeGeminiAdapter } from '../../src/modules/ai/fakeGeminiAdapter.js';
import validItinerary from '../fixtures/itineraries/validBalancedItinerary.json';

let mongod;
let app;

beforeAll(async () => {
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
  if (mongod) await mongod.stop();
});

async function agentFor(email = 'editor@example.com') {
  const password = 'Sup3rSecret!';
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({ email, password });
  await agent.post('/api/auth/login').send({ email, password });
  return agent;
}

// Rome, 2 days, day 1: [Pasticceria Regoli, Colosseum & Roman Forum Tour,
// Trattoria Da Enzo al 29, Pantheon Visit, Dinner in Monti]; day 2 has 5 more.
async function plannedTripWithItinerary(agent) {
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
  const generated = await agent.post(`/api/trips/${id}/generate-itinerary`);
  return { id, trip: generated.body.trip };
}

describe('PATCH /api/trips/:id/itinerary', () => {
  test('rejects unauthenticated requests', async () => {
    const agent = await agentFor();
    const { id } = await plannedTripWithItinerary(agent);

    const res = await request(app)
      .patch(`/api/trips/${id}/itinerary`)
      .send({ op: 'delete', activityId: 'anything' });

    expect(res.status).toBe(401);
  });

  test('rejects a non-owner and leaves the itinerary untouched', async () => {
    const owner = await agentFor('owner@example.com');
    const { id, trip } = await plannedTripWithItinerary(owner);
    const activityId = trip.currentItinerary.days[0].activities[0].id;
    const stranger = await agentFor('stranger@example.com');

    const res = await stranger
      .patch(`/api/trips/${id}/itinerary`)
      .send({ op: 'delete', activityId });
    const after = await Trip.findById(id).lean();

    expect(res.status).toBe(404);
    expect(after.currentItinerary.days[0].activities).toHaveLength(5);
  });

  test('rejects an unknown op', async () => {
    const agent = await agentFor();
    const { id } = await plannedTripWithItinerary(agent);

    const res = await agent.patch(`/api/trips/${id}/itinerary`).send({ op: 'teleport' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_OP');
  });

  test('rejects editing when the trip has no itinerary yet', async () => {
    const agent = await agentFor();
    const created = await agent.post('/api/trips').send({ destination: 'Tokyo' });

    const res = await agent
      .patch(`/api/trips/${created.body.trip.id}/itinerary`)
      .send({ op: 'delete', activityId: 'anything' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('NO_ITINERARY');
  });

  test('adds an activity and persists it across a refetch', async () => {
    const agent = await agentFor();
    const { id } = await plannedTripWithItinerary(agent);

    const res = await agent.patch(`/api/trips/${id}/itinerary`).send({
      op: 'add',
      dayNumber: 1,
      activity: {
        title: 'Gelato stop',
        description: 'Best gelato in town.',
        location: 'Piazza Navona',
        type: 'FOOD',
        durationMinutes: 30,
        period: 'AFTERNOON',
      },
    });

    expect(res.status).toBe(200);
    expect(res.body.trip.currentItinerary.days[0].activities).toHaveLength(6);

    const refetched = await agent.get(`/api/trips/${id}`);
    expect(refetched.body.trip.currentItinerary.days[0].activities).toHaveLength(6);
  });

  test('edits an activity, leaving period/transferBeforeMinutes/id untouched', async () => {
    const agent = await agentFor();
    const { id, trip } = await plannedTripWithItinerary(agent);
    const original = trip.currentItinerary.days[0].activities[1]; // Colosseum tour

    const res = await agent.patch(`/api/trips/${id}/itinerary`).send({
      op: 'edit',
      activityId: original.id,
      updates: {
        title: 'Colosseum (self-guided)',
        description: 'Skip the guided tour, explore alone.',
        location: original.location,
        type: original.type,
        durationMinutes: 90,
      },
    });

    expect(res.status).toBe(200);
    const updated = res.body.trip.currentItinerary.days[0].activities[1];
    expect(updated).toMatchObject({
      id: original.id,
      title: 'Colosseum (self-guided)',
      durationMinutes: 90,
      period: original.period,
      transferBeforeMinutes: original.transferBeforeMinutes,
    });
  });

  test('rejects an edit with an invalid activity type', async () => {
    const agent = await agentFor();
    const { id, trip } = await plannedTripWithItinerary(agent);
    const activityId = trip.currentItinerary.days[0].activities[0].id;

    const res = await agent.patch(`/api/trips/${id}/itinerary`).send({
      op: 'edit',
      activityId,
      updates: {
        title: 'Still breakfast',
        description: 'Still coffee.',
        location: 'Still here',
        type: 'NOT_A_REAL_TYPE',
        durationMinutes: 45,
      },
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_ACTIVITY_TYPE');
  });

  test('deletes an activity', async () => {
    const agent = await agentFor();
    const { id, trip } = await plannedTripWithItinerary(agent);
    const activityId = trip.currentItinerary.days[0].activities[0].id;

    const res = await agent.patch(`/api/trips/${id}/itinerary`).send({ op: 'delete', activityId });

    expect(res.status).toBe(200);
    expect(res.body.trip.currentItinerary.days[0].activities).toHaveLength(4);
    expect(
      res.body.trip.currentItinerary.days[0].activities.find((a) => a.id === activityId),
    ).toBeUndefined();
  });

  test('reorders an activity earlier within its day', async () => {
    const agent = await agentFor();
    const { id, trip } = await plannedTripWithItinerary(agent);
    const activities = trip.currentItinerary.days[0].activities;
    const secondActivityId = activities[1].id;

    const res = await agent
      .patch(`/api/trips/${id}/itinerary`)
      .send({ op: 'reorder', activityId: secondActivityId, direction: 'earlier' });

    expect(res.status).toBe(200);
    expect(res.body.trip.currentItinerary.days[0].activities[0].id).toBe(secondActivityId);
  });

  test('moves an activity to another day, appended at the end', async () => {
    const agent = await agentFor();
    const { id, trip } = await plannedTripWithItinerary(agent);
    const activityId = trip.currentItinerary.days[0].activities[0].id;

    const res = await agent
      .patch(`/api/trips/${id}/itinerary`)
      .send({ op: 'move', activityId, toDayNumber: 2 });

    expect(res.status).toBe(200);
    const day1 = res.body.trip.currentItinerary.days[0].activities;
    const day2 = res.body.trip.currentItinerary.days[1].activities;
    expect(day1.find((a) => a.id === activityId)).toBeUndefined();
    expect(day2.at(-1).id).toBe(activityId);
  });

  test('manual edits are not blocked by AI capacity limits, even overloading a day', async () => {
    const agent = await agentFor();
    const { id } = await plannedTripWithItinerary(agent);

    // Balanced pace allows at most 8 activities/day (PACE_CAPACITY_CONFIG) — add
    // enough to exceed it and confirm the manual-edit path doesn't enforce that cap.
    for (let i = 0; i < 5; i += 1) {
      const res = await agent.patch(`/api/trips/${id}/itinerary`).send({
        op: 'add',
        dayNumber: 1,
        activity: {
          title: `Extra activity ${i}`,
          description: 'Manually added.',
          location: 'Somewhere',
          type: 'OTHER',
          durationMinutes: 15,
          period: 'EVENING',
        },
      });
      expect(res.status).toBe(200);
    }

    const finalTrip = await agent.get(`/api/trips/${id}`);
    expect(finalTrip.body.trip.currentItinerary.days[0].activities).toHaveLength(10);
  });

  test('does not change trip.status or itineraryStatus', async () => {
    const agent = await agentFor();
    const { id, trip } = await plannedTripWithItinerary(agent);
    const activityId = trip.currentItinerary.days[0].activities[0].id;

    const res = await agent.patch(`/api/trips/${id}/itinerary`).send({ op: 'delete', activityId });

    expect(res.body.trip.status).toBe('PLANNED');
    expect(res.body.trip.itineraryStatus).toBe('CURRENT');
  });
});
