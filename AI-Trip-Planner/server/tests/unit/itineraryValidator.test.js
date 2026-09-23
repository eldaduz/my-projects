import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import {
  validateItinerary,
  validateAndFinalizeItinerary,
} from '../../src/modules/ai/itineraryValidator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.resolve(__dirname, '../fixtures/itineraries');

function loadFixture(filename) {
  const content = fs.readFileSync(path.join(fixturesDir, filename), 'utf-8');
  return JSON.parse(content);
}

describe('itineraryValidator', () => {
  describe('Valid Fixtures', () => {
    test('validates valid relaxed itinerary against 2-day relaxed context', () => {
      const itinerary = loadFixture('validRelaxedItinerary.json');
      const context = {
        trip: {
          destination: 'Paris, France',
          startDate: '2026-09-01',
          endDate: '2026-09-02',
          duration: 2,
        },
        paceOverride: 'relaxed',
        preferences: {},
        travelers: [{ travelerName: 'Alice', pace: 'relaxed', preferences: {} }],
      };

      const result = validateItinerary(itinerary, context);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('validates valid balanced itinerary against 2-day balanced context', () => {
      const itinerary = loadFixture('validBalancedItinerary.json');
      const context = {
        trip: {
          destination: 'Rome, Italy',
          startDate: '2026-09-01',
          endDate: '2026-09-02',
          duration: 2,
        },
        paceOverride: 'balanced',
        preferences: {},
        travelers: [{ travelerName: 'Marco', pace: 'balanced', preferences: {} }],
      };

      const result = validateItinerary(itinerary, context);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('validates valid intensive itinerary against 1-day intensive context', () => {
      const itinerary = loadFixture('validIntensiveItinerary.json');
      const context = {
        trip: {
          destination: 'Tokyo, Japan',
          startDate: '2026-09-01',
          endDate: '2026-09-01',
          duration: 1,
        },
        paceOverride: 'intensive',
        preferences: {},
        travelers: [{ travelerName: 'Kenji', pace: 'intensive', preferences: {} }],
      };

      const result = validateItinerary(itinerary, context);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('Schema & Destination Validation', () => {
    test('rejects non-object or null itinerary', () => {
      expect(validateItinerary(null, {}).valid).toBe(false);
      expect(validateItinerary('invalid string', {}).valid).toBe(false);
      expect(validateItinerary([], {}).valid).toBe(false);
    });

    test('rejects missing or empty destination', () => {
      const fixture = loadFixture('invalidSchema.json');
      const result = validateItinerary(fixture, {
        trip: { destination: 'Paris', duration: 1, startDate: '2026-09-01' },
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'SCHEMA_INVALID')).toBe(true);
    });

    test('does not reject a city-level itinerary destination against a broader trip destination', () => {
      // trip.destination "Japan" vs itinerary.destination "Paris, France" share no substring —
      // destination equality is not part of SYSTEM_DESIGN §6.4's validation scope, and a
      // string-matching check can't reliably distinguish a valid region/city answer from a wrong
      // one anyway, so no DESTINATION_MISMATCH should ever be raised.
      const itinerary = loadFixture('validRelaxedItinerary.json');
      const context = {
        trip: {
          destination: 'Japan',
          startDate: '2026-09-01',
          endDate: '2026-09-02',
          duration: 2,
        },
      };

      const result = validateItinerary(itinerary, context);
      expect(result.errors.some((e) => e.code === 'DESTINATION_MISMATCH')).toBe(false);
    });
  });

  describe('Day Count & Date Alignment', () => {
    test('rejects day count mismatch', () => {
      const fixture = loadFixture('invalidDayCount.json');
      const context = {
        trip: {
          destination: 'Rome, Italy',
          startDate: '2026-09-01',
          endDate: '2026-09-03',
          duration: 3,
        },
      };

      const result = validateItinerary(fixture, context);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'DAY_COUNT_MISMATCH')).toBe(true);
    });

    test('rejects date mismatch / skipped dates', () => {
      const fixture = loadFixture('invalidDates.json');
      const context = {
        trip: {
          destination: 'Rome, Italy',
          startDate: '2026-09-01',
          endDate: '2026-09-02',
          duration: 2,
        },
      };

      const result = validateItinerary(fixture, context);
      expect(result.valid).toBe(false);
      const dateErr = result.errors.find((e) => e.code === 'DATE_MISMATCH');
      expect(dateErr).toBeDefined();
      expect(dateErr.path).toBe('days[1].date');
    });

    test('rejects non-sequential day numbers', () => {
      const itinerary = {
        destination: 'Rome',
        days: [
          {
            dayNumber: 2, // expected 1
            date: '2026-09-01',
            title: 'Day 1',
            summary: 'Summary',
            activities: [
              {
                type: 'BREAKFAST',
                title: 'B',
                description: 'D',
                location: 'L',
                period: 'MORNING',
                durationMinutes: 60,
                transferBeforeMinutes: 0,
              },
            ],
          },
        ],
      };
      const context = {
        trip: { destination: 'Rome', startDate: '2026-09-01', duration: 1 },
      };

      const result = validateItinerary(itinerary, context);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'DAY_NUMBER_MISMATCH')).toBe(true);
    });

    function itineraryWithDayNumber(dayNumber) {
      return {
        destination: 'Rome',
        days: [
          {
            dayNumber,
            date: '2026-09-01',
            title: 'Day 1',
            summary: 'Summary',
            activities: [
              {
                type: 'BREAKFAST',
                title: 'B',
                description: 'D',
                location: 'L',
                period: 'MORNING',
                durationMinutes: 60,
                transferBeforeMinutes: 0,
              },
            ],
          },
        ],
      };
    }

    const dayNumberContext = { trip: { destination: 'Rome', startDate: '2026-09-01', duration: 1 } };

    test('accepts a correct dayNumber sent as a numeric string', () => {
      // Gemini's response has no responseSchema enforcing numeric types, so a numerically-correct
      // dayNumber can legally arrive quoted (e.g. "1").
      const result = validateItinerary(itineraryWithDayNumber('1'), dayNumberContext);
      expect(result.errors.some((e) => e.code === 'DAY_NUMBER_MISMATCH')).toBe(false);
    });

    test('still accepts a correct dayNumber sent as a number (no regression)', () => {
      const result = validateItinerary(itineraryWithDayNumber(1), dayNumberContext);
      expect(result.errors.some((e) => e.code === 'DAY_NUMBER_MISMATCH')).toBe(false);
    });

    test('still rejects a genuinely wrong dayNumber, numeric-string or not', () => {
      expect(
        validateItinerary(itineraryWithDayNumber('2'), dayNumberContext).errors.some(
          (e) => e.code === 'DAY_NUMBER_MISMATCH',
        ),
      ).toBe(true);
      expect(
        validateItinerary(itineraryWithDayNumber('not-a-number'), dayNumberContext).errors.some(
          (e) => e.code === 'DAY_NUMBER_MISMATCH',
        ),
      ).toBe(true);
    });
  });

  describe('Enums & Sanity Bounds', () => {
    test('rejects invalid activity type and period enums', () => {
      const fixture = loadFixture('invalidEnums.json');
      const context = {
        trip: {
          destination: 'Rome, Italy',
          startDate: '2026-09-01',
          duration: 1,
        },
      };

      const result = validateItinerary(fixture, context);
      expect(result.valid).toBe(false);
      const enumErrors = result.errors.filter((e) => e.code === 'INVALID_ENUM');
      expect(enumErrors.length).toBe(2);
      expect(enumErrors.some((e) => e.details?.field === 'type')).toBe(true);
      expect(enumErrors.some((e) => e.details?.field === 'period')).toBe(true);
    });

    test('rejects out of bounds duration and transfer minutes', () => {
      const fixture = loadFixture('invalidDurationSanity.json');
      const context = {
        trip: {
          destination: 'Rome, Italy',
          startDate: '2026-09-01',
          duration: 1,
        },
      };

      const result = validateItinerary(fixture, context);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'DURATION_OUT_OF_BOUNDS')).toBe(true);
      expect(result.errors.some((e) => e.code === 'TRANSFER_OUT_OF_BOUNDS')).toBe(true);
    });

    test('rejects out-of-order periods (e.g. EVENING before MORNING on same day)', () => {
      const fixture = loadFixture('invalidPeriodOrder.json');
      const context = {
        trip: {
          destination: 'Rome, Italy',
          startDate: '2026-09-01',
          duration: 1,
        },
      };

      const result = validateItinerary(fixture, context);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'PERIOD_ORDER_INVALID')).toBe(true);
    });
  });

  describe('Pace & Capacity Limits', () => {
    test('rejects when daily activity count or minutes exceeds relaxed pace capacity', () => {
      const fixture = loadFixture('invalidCapacityExceeded.json');
      const context = {
        trip: {
          destination: 'Paris, France',
          startDate: '2026-09-01',
          duration: 1,
        },
        paceOverride: 'relaxed',
      };

      const result = validateItinerary(fixture, context);
      expect(result.valid).toBe(false);
      const capErrors = result.errors.filter((e) => e.code === 'CAPACITY_EXCEEDED');
      expect(capErrors.length).toBeGreaterThan(0);
    });

    test('applies multi-traveler conservative pace rule (relaxed wins over balanced/intensive)', () => {
      const fixture = loadFixture('invalidCapacityExceeded.json');
      const context = {
        trip: {
          destination: 'Paris, France',
          startDate: '2026-09-01',
          duration: 1,
        },
        // No paceOverride; one traveler is relaxed and another is intensive -> effective pace is relaxed
        travelers: [
          { travelerName: 'Tom', pace: 'intensive' },
          { travelerName: 'Jerry', pace: 'relaxed' },
        ],
      };

      const result = validateItinerary(fixture, context);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'CAPACITY_EXCEEDED' && e.details?.pace === 'relaxed')).toBe(
        true,
      );
    });
  });

  describe('BLOCK Category Conflict Detection', () => {
    test('detects BLOCK conflict on trip-level preference override', () => {
      const fixture = loadFixture('invalidBlockConflict.json');
      const context = {
        trip: {
          destination: 'Rome, Italy',
          startDate: '2026-09-01',
          duration: 1,
        },
        preferences: { museums: 'block' },
      };

      const result = validateItinerary(fixture, context);
      expect(result.valid).toBe(false);
      const blockErr = result.errors.find((e) => e.code === 'BLOCK_CONFLICT');
      expect(blockErr).toBeDefined();
      expect(blockErr.details?.category).toBe('museums');
      expect(blockErr.details?.activityType).toBe('MUSEUM');
    });

    test('detects BLOCK conflict from individual traveler preferences', () => {
      const fixture = loadFixture('invalidBlockConflict.json');
      const context = {
        trip: {
          destination: 'Rome, Italy',
          startDate: '2026-09-01',
          duration: 1,
        },
        travelers: [
          { travelerName: 'Alice', preferences: { museums: 'neutral' } },
          { travelerName: 'Bob', preferences: { museums: 'block' } },
        ],
      };

      const result = validateItinerary(fixture, context);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'BLOCK_CONFLICT')).toBe(true);
    });

    test('does not flag false BLOCK conflicts for unmapped categories (photography/landmarks)', () => {
      const itinerary = loadFixture('validRelaxedItinerary.json');
      const context = {
        trip: {
          destination: 'Paris, France',
          startDate: '2026-09-01',
          duration: 2,
        },
        preferences: { photography: 'block', landmarks: 'block' },
      };

      const result = validateItinerary(itinerary, context);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('validateAndFinalizeItinerary', () => {
    test('successfully finalizes valid itinerary and attaches backend activity IDs', () => {
      const rawString = JSON.stringify(loadFixture('validRelaxedItinerary.json'));
      const context = {
        trip: {
          destination: 'Paris, France',
          startDate: '2026-09-01',
          endDate: '2026-09-02',
          duration: 2,
        },
        paceOverride: 'relaxed',
      };

      const finalized = validateAndFinalizeItinerary(rawString, context);
      expect(finalized.valid).toBe(true);
      expect(finalized.errors).toEqual([]);
      expect(finalized.itinerary).toBeDefined();
      expect(finalized.itinerary.days[0].activities[0].id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    test('handles markdown codeblock fenced raw AI string', () => {
      const fencedString = `\`\`\`json\n${JSON.stringify(loadFixture('validRelaxedItinerary.json'))}\n\`\`\``;
      const context = {
        trip: {
          destination: 'Paris, France',
          startDate: '2026-09-01',
          endDate: '2026-09-02',
          duration: 2,
        },
        paceOverride: 'relaxed',
      };

      const finalized = validateAndFinalizeItinerary(fencedString, context);
      expect(finalized.valid).toBe(true);
      expect(finalized.itinerary).toBeDefined();
    });

    test('returns invalid result with no itinerary when JSON parse fails', () => {
      const result = validateAndFinalizeItinerary('{ incomplete json', {});
      expect(result.valid).toBe(false);
      expect(result.itinerary).toBeNull();
      expect(result.errors[0].code).toBe('JSON_PARSE_ERROR');
    });

    test('returns invalid result with no itinerary or IDs when validation fails', () => {
      const rawString = JSON.stringify(loadFixture('invalidBlockConflict.json'));
      const context = {
        trip: {
          destination: 'Rome, Italy',
          startDate: '2026-09-01',
          duration: 1,
        },
        preferences: { museums: 'block' },
      };

      const finalized = validateAndFinalizeItinerary(rawString, context);
      expect(finalized.valid).toBe(false);
      expect(finalized.itinerary).toBeNull();
      expect(finalized.errors.length).toBeGreaterThan(0);
    });
  });
});
