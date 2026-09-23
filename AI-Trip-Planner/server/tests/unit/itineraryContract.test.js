import { describe, expect, test } from 'vitest';
import {
  PERIODS,
  ACTIVITY_TYPES,
  PREFERENCE_CATEGORY_ACTIVITY_TYPE_MAP,
  UNMAPPED_PREFERENCE_CATEGORIES,
  PACE_CAPACITY_CONFIG,
  resolveEffectivePace,
  parseRawItineraryJson,
  assignActivityIds,
} from '../../src/modules/ai/itineraryContract.js';
import { PREFERENCE_CATEGORIES } from '../../src/modules/travelers/travelerProfile.model.js';

describe('itineraryContract', () => {
  test('frozen enums match System Design specifications', () => {
    expect(PERIODS).toEqual(['MORNING', 'AFTERNOON', 'EVENING']);
    expect(ACTIVITY_TYPES).toEqual([
      'BREAKFAST',
      'LUNCH',
      'DINNER',
      'ATTRACTION',
      'MUSEUM',
      'CULTURE',
      'HISTORY',
      'ARCHITECTURE',
      'FOOD',
      'NATURE',
      'SHOPPING',
      'NIGHTLIFE',
      'BEACH',
      'SPORT',
      'FAMILY',
      'TOUR',
      'FREE_TIME',
      'TRANSPORT',
      'OTHER',
    ]);
  });

  test('all 15 preference categories are accounted for in mapped or intentionally unmapped constants', () => {
    const mappedKeys = Object.keys(PREFERENCE_CATEGORY_ACTIVITY_TYPE_MAP);
    const combined = [...mappedKeys, ...UNMAPPED_PREFERENCE_CATEGORIES];

    // Every defined preference category from traveler profiles must be in either mapped or unmapped
    for (const category of PREFERENCE_CATEGORIES) {
      expect(combined).toContain(category);
    }
    expect(combined.length).toBe(PREFERENCE_CATEGORIES.length);
    expect(UNMAPPED_PREFERENCE_CATEGORIES).toEqual(['photography', 'landmarks']);

    // Every mapped activity type must exist in ACTIVITY_TYPES
    for (const activityTypes of Object.values(PREFERENCE_CATEGORY_ACTIVITY_TYPE_MAP)) {
      for (const type of activityTypes) {
        expect(ACTIVITY_TYPES).toContain(type);
      }
    }
  });

  test('capacity configurations are defined for all 3 paces', () => {
    expect(PACE_CAPACITY_CONFIG).toHaveProperty('relaxed');
    expect(PACE_CAPACITY_CONFIG).toHaveProperty('balanced');
    expect(PACE_CAPACITY_CONFIG).toHaveProperty('intensive');

    expect(PACE_CAPACITY_CONFIG.relaxed.maxActiveMinutesPerDay).toBeLessThan(
      PACE_CAPACITY_CONFIG.balanced.maxActiveMinutesPerDay,
    );
    expect(PACE_CAPACITY_CONFIG.balanced.maxActiveMinutesPerDay).toBeLessThan(
      PACE_CAPACITY_CONFIG.intensive.maxActiveMinutesPerDay,
    );
  });

  describe('resolveEffectivePace', () => {
    test('paceOverride takes highest priority when set', () => {
      const context = {
        paceOverride: 'intensive',
        travelers: [{ pace: 'relaxed' }, { pace: 'balanced' }],
      };
      expect(resolveEffectivePace(context)).toBe('intensive');
    });

    test('defaults to balanced when no pace is set anywhere', () => {
      expect(resolveEffectivePace({})).toBe('balanced');
      expect(resolveEffectivePace({ travelers: [{ pace: null }, { pace: undefined }] })).toBe('balanced');
    });

    test('applies conservative rule: relaxed wins if any traveler is relaxed', () => {
      expect(
        resolveEffectivePace({
          travelers: [{ pace: 'balanced' }, { pace: 'relaxed' }, { pace: 'intensive' }],
        }),
      ).toBe('relaxed');
    });

    test('resolves to intensive only if all travelers with a specified pace are intensive', () => {
      expect(
        resolveEffectivePace({
          travelers: [{ pace: 'intensive' }, { pace: 'intensive' }],
        }),
      ).toBe('intensive');

      expect(
        resolveEffectivePace({
          travelers: [{ pace: 'intensive' }, { pace: null }],
        }),
      ).toBe('intensive');
    });

    test('resolves to balanced when there is a mix of balanced and intensive', () => {
      expect(
        resolveEffectivePace({
          travelers: [{ pace: 'intensive' }, { pace: 'balanced' }],
        }),
      ).toBe('balanced');
    });
  });

  describe('parseRawItineraryJson', () => {
    test('parses clean JSON string', () => {
      const parsed = parseRawItineraryJson('{"destination": "Tokyo"}');
      expect(parsed).toEqual({ destination: 'Tokyo' });
    });

    test('parses markdown-fenced JSON string', () => {
      const markdown = '```json\n{"destination": "Tokyo", "days": []}\n```';
      expect(parseRawItineraryJson(markdown)).toEqual({ destination: 'Tokyo', days: [] });
    });

    test('passes through already parsed objects', () => {
      const obj = { destination: 'Paris' };
      expect(parseRawItineraryJson(obj)).toBe(obj);
    });

    test('throws on malformed JSON', () => {
      expect(() => parseRawItineraryJson('{"invalid: json')).toThrow(/Failed to parse itinerary JSON/i);
    });
  });

  describe('assignActivityIds', () => {
    test('assigns unique UUIDs to every activity and replaces any AI-provided id', () => {
      const rawItinerary = {
        destination: 'Rome',
        days: [
          {
            dayNumber: 1,
            activities: [
              { id: 'ai-fake-id-1', type: 'BREAKFAST', title: 'Espresso' },
              { type: 'MUSEUM', title: 'Colosseum' },
            ],
          },
          {
            dayNumber: 2,
            activities: [{ id: 'ai-fake-id-2', type: 'DINNER', title: 'Pasta' }],
          },
        ],
      };

      const result = assignActivityIds(rawItinerary);

      expect(result.days[0].activities[0].id).not.toBe('ai-fake-id-1');
      expect(result.days[0].activities[0].id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
      expect(result.days[0].activities[1].id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
      expect(result.days[1].activities[0].id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );

      // Verify all IDs are distinct
      const ids = [
        result.days[0].activities[0].id,
        result.days[0].activities[1].id,
        result.days[1].activities[0].id,
      ];
      expect(new Set(ids).size).toBe(3);
    });
  });
});
