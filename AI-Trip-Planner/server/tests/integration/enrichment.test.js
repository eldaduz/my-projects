// server/tests/integration/enrichment.test.js
import { describe, test, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../../src/app.js';
import { User } from '../../src/modules/auth/user.model.js';
import { SESSION_COOKIE_NAME } from '../../src/modules/auth/session.js';

let mongod;
let app;
let placesAdapter;
let weatherAdapter;
let photoAdapter;
let sessionCookie;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterEach(async () => {
  await User.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

async function loginTestUser(appInstance) {
  await request(appInstance).post('/api/auth/register').send({
    email: 'enrichment@example.com',
    password: 'Password123!',
    name: 'Enrichment Tester',
  });
  const res = await request(appInstance).post('/api/auth/login').send({
    email: 'enrichment@example.com',
    password: 'Password123!',
  });
  const cookie = res.headers['set-cookie'].find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
  return cookie;
}

describe('enrichment routes', () => {
  beforeAll(async () => {
    placesAdapter = {
      autocomplete: vi.fn().mockResolvedValue([{ label: 'Paris, France', lat: 48.85, lon: 2.35 }]),
      geocode: vi.fn().mockResolvedValue({ lat: 48.85, lon: 2.35 }),
    };
    weatherAdapter = {
      getForecast: vi.fn().mockResolvedValue([{ date: '2026-09-01', tempMaxC: 24, tempMinC: 15, precipitationChance: 10, weatherCode: 1 }]),
    };
    photoAdapter = { getPhoto: vi.fn().mockResolvedValue({ url: 'https://img.example/paris.jpg', attribution: 'Wikipedia', source: 'wikipedia' }) };
    app = createApp({ placesAdapter, weatherAdapter, photoAdapter });
  });

  // Re-login before every test: the file-level afterEach wipes Users after
  // each test (requireAuth resolves sessions via User.findById), so a
  // session obtained once in beforeAll would 401 starting with the 2nd test.
  beforeEach(async () => {
    sessionCookie = await loginTestUser(app);
  });

  test('GET /api/enrichment/autocomplete returns suggestions for an authenticated user', async () => {
    const res = await request(app).get('/api/enrichment/autocomplete?q=Par').set('Cookie', sessionCookie);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ suggestions: [{ label: 'Paris, France', lat: 48.85, lon: 2.35 }] });
  });

  test('GET /api/enrichment/autocomplete requires auth', async () => {
    const res = await request(app).get('/api/enrichment/autocomplete?q=Par');
    expect(res.status).toBe(401);
  });

  test('GET /api/enrichment/weather geocodes the destination then fetches the forecast', async () => {
    const res = await request(app)
      .get('/api/enrichment/weather?destination=Paris&startDate=2026-09-01&endDate=2026-09-01')
      .set('Cookie', sessionCookie);

    expect(res.status).toBe(200);
    expect(res.body.available).toBe(true);
    expect(res.body.days).toHaveLength(1);
    expect(placesAdapter.geocode).toHaveBeenCalledWith('Paris');
    expect(weatherAdapter.getForecast).toHaveBeenCalledWith({ lat: 48.85, lon: 2.35, startDate: '2026-09-01', endDate: '2026-09-01' });
  });

  test('GET /api/enrichment/weather degrades gracefully when geocoding fails', async () => {
    placesAdapter.geocode.mockResolvedValueOnce(null);

    const res = await request(app)
      .get('/api/enrichment/weather?destination=Nowhereville&startDate=2026-09-01&endDate=2026-09-01')
      .set('Cookie', sessionCookie);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ available: false });
  });

  test('GET /api/enrichment/weather requires destination/startDate/endDate query params', async () => {
    const res = await request(app).get('/api/enrichment/weather?destination=Paris').set('Cookie', sessionCookie);
    expect(res.status).toBe(400);
  });

  test('GET /api/enrichment/photo returns a photo for the destination', async () => {
    const res = await request(app).get('/api/enrichment/photo?destination=Paris').set('Cookie', sessionCookie);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ available: true, url: 'https://img.example/paris.jpg', attribution: 'Wikipedia', source: 'wikipedia' });
  });

  test('GET /api/enrichment/photo degrades gracefully when no photo is found', async () => {
    photoAdapter.getPhoto.mockResolvedValueOnce(null);

    const res = await request(app).get('/api/enrichment/photo?destination=Nowhereville').set('Cookie', sessionCookie);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ available: false });
  });
});
