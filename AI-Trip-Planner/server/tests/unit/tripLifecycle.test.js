import { describe, test, expect } from 'vitest';
import { isMaterialChange, applyStaleIfMaterial, MATERIAL_TRIP_FIELDS } from '../../src/modules/trips/tripLifecycle.js';

describe('isMaterialChange', () => {
  test('treats dates, travelers, children, pace, preferences, constraints, and mustDo as material', () => {
    for (const field of MATERIAL_TRIP_FIELDS) {
      expect(isMaterialChange([field])).toBe(true);
    }
  });

  test('treats tripTitle, accommodation, budgetLevel, and notes as non-material', () => {
    expect(isMaterialChange(['tripTitle', 'accommodation', 'budgetLevel', 'notes'])).toBe(false);
  });

  test('returns false for no changes', () => {
    expect(isMaterialChange([])).toBe(false);
  });
});

describe('applyStaleIfMaterial', () => {
  test('marks itineraryStatus STALE on a material change once a currentItinerary exists', () => {
    const trip = { currentItinerary: { days: [] }, itineraryStatus: 'CURRENT' };
    applyStaleIfMaterial(trip, ['startDate']);
    expect(trip.itineraryStatus).toBe('STALE');
  });

  test('does not touch itineraryStatus for a non-material change', () => {
    const trip = { currentItinerary: { days: [] }, itineraryStatus: 'CURRENT' };
    applyStaleIfMaterial(trip, ['tripTitle', 'notes']);
    expect(trip.itineraryStatus).toBe('CURRENT');
  });

  test('is a no-op before a currentItinerary exists, even for a material change', () => {
    const trip = { currentItinerary: null, itineraryStatus: null };
    applyStaleIfMaterial(trip, ['travelers']);
    expect(trip.itineraryStatus).toBeNull();
  });
});
