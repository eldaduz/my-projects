import { PREFERENCE_CATEGORIES } from '../travelers/travelerProfile.model.js';

const TRAVELER_FIELDS = [
  'travelerName',
  'ageGroup',
  'pace',
  'foodCuisineInterests',
  'dietaryRestrictions',
  'dietaryRequirements',
  'indoorOutdoorTendency',
  'walkingTolerance',
  'hardConstraints',
  'travelStyleNote',
];

const DEFAULT_PREFERENCE = 'neutral';

function plain(value) {
  return value?.toObject instanceof Function ? value.toObject({ depopulate: true }) : value;
}

function preferences(value) {
  const source = plain(value) ?? {};
  return Object.fromEntries(
    PREFERENCE_CATEGORIES.map((category) => [category, source[category] ?? DEFAULT_PREFERENCE]),
  );
}

function dateOnly(value, field) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new Error(`${field} is invalid.`);
    return value.toISOString().slice(0, 10);
  }

  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} is required.`);
  const input = value.trim();
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) throw new Error(`${field} is invalid.`);
  const normalized = date.toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(input) && normalized !== input) {
    throw new Error(`${field} is invalid.`);
  }
  return normalized;
}

function copyTraveler(value) {
  const source = plain(value) ?? {};
  return {
    ...Object.fromEntries(TRAVELER_FIELDS.map((field) => [field, source[field] ?? null])),
    preferences: preferences(source.preferences),
  };
}

function durationBetween(startDate, endDate) {
  return Math.round((Date.parse(endDate) - Date.parse(startDate)) / 86400000) + 1;
}

// F17.2: replan reconstructs the full context from scratch every time (no
// persisted Gemini session) and layers on the current itinerary (with any
// prior manual edits) plus the user's replanInstruction — everything else is
// identical to the generation context so the same validator/corrective-pass
// pattern applies unchanged.
export function buildPlanningContext(trip, { currentItinerary, replanInstruction } = {}) {
  const source = plain(trip) ?? {};
  const profile = plain(source.tripProfile) ?? {};
  const startDate = dateOnly(source.startDate, 'startDate');
  const endDate = dateOnly(source.endDate, 'endDate');
  const duration = durationBetween(startDate, endDate);

  if (typeof source.destination !== 'string' || !source.destination.trim()) {
    throw new Error('destination is required.');
  }
  if (duration < 1) throw new Error('Date range is invalid.');

  const accommodation = plain(profile.accommodation) ?? {};
  return {
    trip: {
      destination: source.destination,
      startDate,
      endDate,
      duration,
    },
    travelers: (profile.travelers ?? []).map(copyTraveler),
    children: (profile.children ?? []).map((child) => ({ age: plain(child)?.age ?? null })),
    preferences: preferences(profile.preferences),
    hardConstraints: profile.hardConstraints ?? null,
    paceOverride: profile.paceOverride ?? null,
    accommodation: {
      hotelBooked: accommodation.hotelBooked ?? null,
      hotelName: accommodation.hotelName ?? null,
      hotelArea: accommodation.hotelArea ?? null,
    },
    budget: profile.budgetLevel ?? null,
    mustDo: Array.isArray(profile.mustDo) ? [...profile.mustDo] : [],
    notes: profile.notes ?? null,
    ...(currentItinerary !== undefined ? { currentItinerary: plain(currentItinerary) } : {}),
    ...(replanInstruction !== undefined ? { replanInstruction } : {}),
  };
}
