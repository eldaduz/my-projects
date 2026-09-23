import { describe, test, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

// photoRateLimiter reads env.photoRateLimitMax/WindowMs at module load time,
// so a low max is set before importing it — mirrors env.test.js's
// reset-modules-then-import pattern for testing config-dependent behavior.
async function loadPhotoRateLimiter({ max }) {
  vi.resetModules();
  process.env.PHOTO_RATE_LIMIT_MAX = String(max);
  const { photoRateLimiter } = await import('../../src/middleware/enrichmentRateLimiter.js');
  return photoRateLimiter;
}

describe('photoRateLimiter', () => {
  test('shares one budget across different IPs (global cap, not per-IP)', async () => {
    const photoRateLimiter = await loadPhotoRateLimiter({ max: 2 });
    const app = express();
    app.set('trust proxy', 1);
    app.get('/photo', photoRateLimiter, (req, res) => res.json({ ok: true }));

    const first = await request(app).get('/photo').set('X-Forwarded-For', '1.1.1.1');
    const second = await request(app).get('/photo').set('X-Forwarded-For', '2.2.2.2');
    const third = await request(app).get('/photo').set('X-Forwarded-For', '3.3.3.3');

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    // Third request, from a third distinct IP, still hits the shared budget's
    // limit — proving the cap is global, not reset per caller.
    expect(third.status).toBe(429);
    expect(third.body.error.code).toBe('RATE_LIMITED');
  });
});
