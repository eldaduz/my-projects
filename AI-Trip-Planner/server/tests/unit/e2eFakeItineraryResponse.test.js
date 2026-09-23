import { describe, test, expect } from 'vitest';
import { buildFakeItineraryResponse } from '../../src/modules/ai/e2eFakeItineraryResponse.js';

const CONTEXT = {
  trip: { destination: 'Lisbon, Portugal', startDate: '2026-09-01', endDate: '2026-09-03', duration: 3 },
};

describe('buildFakeItineraryResponse', () => {
  test('produces one day per context.trip.duration with sequential dayNumber and matching dates', () => {
    const parsed = JSON.parse(buildFakeItineraryResponse(CONTEXT));

    expect(parsed.destination).toBe('Lisbon, Portugal');
    expect(parsed.days).toHaveLength(3);
    expect(parsed.days.map((d) => d.dayNumber)).toEqual([1, 2, 3]);
    expect(parsed.days.map((d) => d.date)).toEqual(['2026-09-01', '2026-09-02', '2026-09-03']);
  });

  test('every day has MORNING/AFTERNOON/EVENING activities within duration bounds', () => {
    const parsed = JSON.parse(buildFakeItineraryResponse(CONTEXT));

    for (const day of parsed.days) {
      const periods = day.activities.map((a) => a.period);
      expect(periods).toEqual(['MORNING', 'AFTERNOON', 'EVENING']);
      for (const activity of day.activities) {
        expect(activity.durationMinutes).toBeGreaterThanOrEqual(10);
        expect(activity.durationMinutes).toBeLessThanOrEqual(720);
        expect(typeof activity.title).toBe('string');
        expect(activity.title.length).toBeGreaterThan(0);
      }
    }
  });

  test('accepts a single-day trip', () => {
    const parsed = JSON.parse(
      buildFakeItineraryResponse({
        trip: { destination: 'Porto', startDate: '2026-09-01', endDate: '2026-09-01', duration: 1 },
      }),
    );

    expect(parsed.days).toHaveLength(1);
    expect(parsed.days[0].dayNumber).toBe(1);
    expect(parsed.days[0].date).toBe('2026-09-01');
  });
});
