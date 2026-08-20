import crypto from 'node:crypto';

export const PERIODS = Object.freeze(['MORNING', 'AFTERNOON', 'EVENING']);

export const ACTIVITY_TYPES = Object.freeze([
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

// Controlled preference categories mapped to corresponding activity types for direct BLOCK checks.
export const PREFERENCE_CATEGORY_ACTIVITY_TYPE_MAP = Object.freeze({
  history: Object.freeze(['HISTORY']),
  culture: Object.freeze(['CULTURE']),
  museums: Object.freeze(['MUSEUM']),
  architecture: Object.freeze(['ARCHITECTURE']),
  food: Object.freeze(['FOOD']),
  nightlife: Object.freeze(['NIGHTLIFE']),
  shopping: Object.freeze(['SHOPPING']),
  nature: Object.freeze(['NATURE']),
  beaches: Object.freeze(['BEACH']),
  sports: Object.freeze(['SPORT']),
  familyActivities: Object.freeze(['FAMILY']),
  guidedTours: Object.freeze(['TOUR']),
  dayTrips: Object.freeze(['TOUR']),
});

// ponytail: 'photography' and 'landmarks' are controlled preference categories in F05/F11,
// but have no corresponding dedicated 1:1 enum value in the frozen ACTIVITY_TYPES.
// They represent general sightseeing/stylistic preferences guided via prompt context
// rather than a single distinct activity type, so they cannot be directly detected by activity.type alone.
export const UNMAPPED_PREFERENCE_CATEGORIES = Object.freeze(['photography', 'landmarks']);

export const PACE_CAPACITY_CONFIG = Object.freeze({
  relaxed: Object.freeze({
    maxActiveMinutesPerDay: 480, // 8 hours of active scheduled time
    maxActivitiesPerDay: 5,
  }),
  balanced: Object.freeze({
    maxActiveMinutesPerDay: 660, // 11 hours of active scheduled time
    maxActivitiesPerDay: 8,
  }),
  intensive: Object.freeze({
    maxActiveMinutesPerDay: 840, // 14 hours (08:00 - 22:00 full window)
    maxActivitiesPerDay: 11,
  }),
});

export const ACTIVITY_DURATION_BOUNDS = Object.freeze({
  minMinutes: 10,
  maxMinutes: 720,
});

export const ACTIVITY_TRANSFER_BOUNDS = Object.freeze({
  minMinutes: 0,
  maxMinutes: 240,
});

/**
 * Resolves the effective pace for capacity validation.
 * 1. If trip paceOverride is set, it takes precedence.
 * 2. If paceOverride is unset, applies the most-conservative traveler rule:
 *    - If ANY traveler has pace === 'relaxed', effective pace is 'relaxed'.
 *    - Otherwise, if ALL travelers with a specified pace have 'intensive', effective pace is 'intensive'.
 *    - Otherwise (or if no travelers have a specified pace), defaults to 'balanced'.
 */
export function resolveEffectivePace(context) {
  if (context?.paceOverride && PACE_CAPACITY_CONFIG[context.paceOverride]) {
    return context.paceOverride;
  }

  const travelers = Array.isArray(context?.travelers) ? context.travelers : [];
  const paces = travelers.map((t) => t?.pace).filter((p) => Boolean(p) && PACE_CAPACITY_CONFIG[p]);

  if (paces.length === 0) {
    return 'balanced';
  }

  if (paces.includes('relaxed')) {
    return 'relaxed';
  }

  if (paces.every((p) => p === 'intensive')) {
    return 'intensive';
  }

  return 'balanced';
}

/**
 * Strips raw AI Markdown fences if present and parses JSON.
 */
export function parseRawItineraryJson(raw) {
  if (raw === null || raw === undefined) {
    throw new Error('Raw itinerary output is required.');
  }
  if (typeof raw === 'object') {
    return raw;
  }
  if (typeof raw !== 'string') {
    throw new Error('Raw itinerary output must be a string or JSON object.');
  }

  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`Failed to parse itinerary JSON: ${err.message}`);
  }
}

/**
 * Assigns authoritative backend UUIDs to all activities after validation.
 * Discards any client/AI-supplied activity ids.
 */
export function assignActivityIds(itinerary) {
  // ponytail: native Node.js crypto.randomUUID() avoids adding external ID dependencies.
  if (!itinerary || typeof itinerary !== 'object') return itinerary;

  return {
    ...itinerary,
    days: (itinerary.days ?? []).map((day) => ({
      ...day,
      activities: (day.activities ?? []).map((activity) => {
        const { id: _ignoredId, ...rest } = activity ?? {};
        return {
          id: crypto.randomUUID(),
          ...rest,
        };
      }),
    })),
  };
}
