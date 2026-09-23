import { describe, expect, test } from 'vitest';
import { buildPlanningContext } from '../../src/modules/ai/planningContext.js';

const trip = {
  destination: 'Budapest',
  startDate: '2026-10-01',
  endDate: '2026-10-04',
  tripProfile: {
    travelers: [
      {
        travelerName: 'Ava',
        ageGroup: 'adult',
        pace: 'relaxed',
        preferences: { museums: 'block', food: 'interested' },
        foodCuisineInterests: 'Local food',
        hardConstraints: 'No stairs',
        sourceTravelerProfileId: 'metadata-must-not-leak',
      },
      { travelerName: 'Noah', preferences: { museums: 'avoid' } },
    ],
    children: [{ age: 6 }],
    accommodation: { hotelBooked: false, hotelArea: 'District V' },
    budgetLevel: 'moderate',
    paceOverride: 'balanced',
    preferences: { museums: 'block', nightlife: 'avoid' },
    hardConstraints: 'Keep evenings short',
    mustDo: ['Thermal baths'],
    notes: 'Anniversary trip',
  },
  internalOnly: 'must-not-leak',
};

describe('buildPlanningContext', () => {
test('maps planning fields deterministically without metadata or mutation', () => {
    const before = structuredClone(trip);
    const first = buildPlanningContext(trip);
    const second = buildPlanningContext(trip);

    expect(first).toEqual({
      trip: {
        destination: 'Budapest',
        startDate: '2026-10-01',
        endDate: '2026-10-04',
        duration: 4,
      },
      travelers: [
        {
          travelerName: 'Ava',
          ageGroup: 'adult',
          pace: 'relaxed',
          preferences: {
            history: 'neutral',
            culture: 'neutral',
            museums: 'block',
            architecture: 'neutral',
            food: 'interested',
            nightlife: 'neutral',
            shopping: 'neutral',
            nature: 'neutral',
            beaches: 'neutral',
            photography: 'neutral',
            landmarks: 'neutral',
            sports: 'neutral',
            familyActivities: 'neutral',
            guidedTours: 'neutral',
            dayTrips: 'neutral',
          },
          foodCuisineInterests: 'Local food',
          dietaryRestrictions: null,
          dietaryRequirements: null,
          indoorOutdoorTendency: null,
          walkingTolerance: null,
          hardConstraints: 'No stairs',
          travelStyleNote: null,
        },
        {
          travelerName: 'Noah',
          ageGroup: null,
          pace: null,
          preferences: {
            history: 'neutral',
            culture: 'neutral',
            museums: 'avoid',
            architecture: 'neutral',
            food: 'neutral',
            nightlife: 'neutral',
            shopping: 'neutral',
            nature: 'neutral',
            beaches: 'neutral',
            photography: 'neutral',
            landmarks: 'neutral',
            sports: 'neutral',
            familyActivities: 'neutral',
            guidedTours: 'neutral',
            dayTrips: 'neutral',
          },
          foodCuisineInterests: null,
          dietaryRestrictions: null,
          dietaryRequirements: null,
          indoorOutdoorTendency: null,
          walkingTolerance: null,
          hardConstraints: null,
          travelStyleNote: null,
        },
      ],
      children: [{ age: 6 }],
      preferences: {
        history: 'neutral',
        culture: 'neutral',
        museums: 'block',
        architecture: 'neutral',
        food: 'neutral',
        nightlife: 'avoid',
        shopping: 'neutral',
        nature: 'neutral',
        beaches: 'neutral',
        photography: 'neutral',
        landmarks: 'neutral',
        sports: 'neutral',
        familyActivities: 'neutral',
        guidedTours: 'neutral',
        dayTrips: 'neutral',
      },
      hardConstraints: 'Keep evenings short',
      paceOverride: 'balanced',
      accommodation: { hotelBooked: false, hotelName: null, hotelArea: 'District V' },
      budget: 'moderate',
      mustDo: ['Thermal baths'],
      notes: 'Anniversary trip',
    });
    expect(second).toEqual(first);
    expect(first).not.toHaveProperty('internalOnly');
    expect(first.travelers[0]).not.toHaveProperty('sourceTravelerProfileId');
    expect(trip).toEqual(before);
  });

  test('normalizes Date values and rejects unusable basics', () => {
    expect(
      buildPlanningContext({
        destination: 'Rome',
        startDate: new Date('2026-09-01T12:00:00.000Z'),
        endDate: new Date('2026-09-02T12:00:00.000Z'),
      }).trip,
    ).toMatchObject({ startDate: '2026-09-01', endDate: '2026-09-02', duration: 2 });

    expect(() => buildPlanningContext({ startDate: '2026-09-01', endDate: '2026-09-02' })).toThrow(
      /destination/i,
    );
    expect(() => buildPlanningContext({ destination: 'Rome', startDate: '2026-09-03', endDate: '2026-09-02' })).toThrow(
      /date/i,
    );
  });

  test('F17.2: includes currentItinerary and replanInstruction only when supplied for replan', () => {
    const withoutReplan = buildPlanningContext(trip);
    expect(withoutReplan).not.toHaveProperty('currentItinerary');
    expect(withoutReplan).not.toHaveProperty('replanInstruction');

    const priorItinerary = { destination: 'Budapest', days: [{ dayNumber: 1, title: 'Manually edited' }] };
    const withReplan = buildPlanningContext(trip, {
      currentItinerary: priorItinerary,
      replanInstruction: 'Swap day 2 for something more relaxed',
    });
    expect(withReplan.currentItinerary).toEqual(priorItinerary);
    expect(withReplan.replanInstruction).toBe('Swap day 2 for something more relaxed');
    expect(withReplan.trip).toEqual(withoutReplan.trip);
  });
});
