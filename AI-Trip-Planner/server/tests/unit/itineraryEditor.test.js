import { describe, test, expect } from 'vitest';
import {
  addActivity,
  editActivity,
  deleteActivity,
  reorderActivity,
  moveActivity,
} from '../../src/modules/trips/itineraryEditor.js';

function makeItinerary() {
  return {
    destination: 'Rome, Italy',
    days: [
      {
        dayNumber: 1,
        date: '2026-09-01',
        title: 'Day one',
        summary: 'Summary one',
        activities: [
          {
            id: 'a1',
            period: 'MORNING',
            type: 'BREAKFAST',
            title: 'Breakfast',
            description: 'Coffee and pastry.',
            location: 'Cafe',
            durationMinutes: 45,
            transferBeforeMinutes: 0,
          },
          {
            id: 'a2',
            period: 'AFTERNOON',
            type: 'HISTORY',
            title: 'Colosseum',
            description: 'Guided tour.',
            location: 'Piazza del Colosseo',
            durationMinutes: 120,
            transferBeforeMinutes: 20,
          },
        ],
      },
      {
        dayNumber: 2,
        date: '2026-09-02',
        title: 'Day two',
        summary: 'Summary two',
        activities: [
          {
            id: 'b1',
            period: 'MORNING',
            type: 'MUSEUM',
            title: 'Vatican Museums',
            description: 'Sistine Chapel.',
            location: 'Vatican City',
            durationMinutes: 150,
            transferBeforeMinutes: 30,
          },
        ],
      },
    ],
  };
}

const validNewActivity = {
  title: 'Gelato stop',
  description: 'Best gelato in town.',
  location: 'Piazza Navona',
  type: 'FOOD',
  durationMinutes: 30,
  period: 'AFTERNOON',
};

describe('addActivity', () => {
  test('appends a new activity to the chosen day with a generated id', () => {
    const itinerary = makeItinerary();
    addActivity(itinerary, { dayNumber: 1, activity: validNewActivity });

    const activities = itinerary.days[0].activities;
    expect(activities).toHaveLength(3);
    expect(activities[2]).toMatchObject({
      title: 'Gelato stop',
      type: 'FOOD',
      period: 'AFTERNOON',
      durationMinutes: 30,
      transferBeforeMinutes: 0,
    });
    expect(activities[2].id).toEqual(expect.any(String));
  });

  test('rejects an unknown day number', () => {
    const itinerary = makeItinerary();
    expect(() => addActivity(itinerary, { dayNumber: 9, activity: validNewActivity })).toThrow(
      /Day 9 does not exist/,
    );
  });

  test('rejects an activity type outside the controlled enum', () => {
    const itinerary = makeItinerary();
    expect(() =>
      addActivity(itinerary, { dayNumber: 1, activity: { ...validNewActivity, type: 'PARTY' } }),
    ).toThrow(/type must be one of/);
  });

  test('rejects a duration outside the frozen bounds', () => {
    const itinerary = makeItinerary();
    expect(() =>
      addActivity(itinerary, { dayNumber: 1, activity: { ...validNewActivity, durationMinutes: 5 } }),
    ).toThrow(/duration must be an integer between/);
  });

  test('rejects a missing/blank title', () => {
    const itinerary = makeItinerary();
    expect(() =>
      addActivity(itinerary, { dayNumber: 1, activity: { ...validNewActivity, title: '  ' } }),
    ).toThrow(/title is required/);
  });

  test('rejects a period outside the controlled enum', () => {
    const itinerary = makeItinerary();
    expect(() =>
      addActivity(itinerary, { dayNumber: 1, activity: { ...validNewActivity, period: 'NIGHT' } }),
    ).toThrow(/period must be one of/);
  });
});

describe('editActivity', () => {
  test('updates title/description/location/type/durationMinutes only', () => {
    const itinerary = makeItinerary();
    editActivity(itinerary, {
      activityId: 'a2',
      updates: {
        title: 'Colosseum (updated)',
        description: 'Updated description.',
        location: 'Updated location',
        type: 'CULTURE',
        durationMinutes: 90,
      },
    });

    const activity = itinerary.days[0].activities[1];
    expect(activity).toMatchObject({
      id: 'a2',
      title: 'Colosseum (updated)',
      type: 'CULTURE',
      durationMinutes: 90,
      period: 'AFTERNOON', // untouched — not a user-edit field
      transferBeforeMinutes: 20, // untouched — system estimate, not a user-edit field
    });
  });

  test('throws 404 for an unknown activity id', () => {
    const itinerary = makeItinerary();
    expect(() =>
      editActivity(itinerary, { activityId: 'missing', updates: validNewActivity }),
    ).toThrow(/Activity not found/);
  });
});

describe('deleteActivity', () => {
  test('removes the activity from its day', () => {
    const itinerary = makeItinerary();
    deleteActivity(itinerary, { activityId: 'a1' });
    expect(itinerary.days[0].activities.map((a) => a.id)).toEqual(['a2']);
  });

  test('throws 404 for an unknown activity id', () => {
    const itinerary = makeItinerary();
    expect(() => deleteActivity(itinerary, { activityId: 'missing' })).toThrow(/Activity not found/);
  });
});

describe('reorderActivity', () => {
  test('swaps with the previous activity when moved earlier', () => {
    const itinerary = makeItinerary();
    reorderActivity(itinerary, { activityId: 'a2', direction: 'earlier' });
    expect(itinerary.days[0].activities.map((a) => a.id)).toEqual(['a2', 'a1']);
  });

  test('swaps with the next activity when moved later', () => {
    const itinerary = makeItinerary();
    reorderActivity(itinerary, { activityId: 'a1', direction: 'later' });
    expect(itinerary.days[0].activities.map((a) => a.id)).toEqual(['a2', 'a1']);
  });

  test('is a no-op at the start-of-day boundary', () => {
    const itinerary = makeItinerary();
    reorderActivity(itinerary, { activityId: 'a1', direction: 'earlier' });
    expect(itinerary.days[0].activities.map((a) => a.id)).toEqual(['a1', 'a2']);
  });

  test('is a no-op at the end-of-day boundary', () => {
    const itinerary = makeItinerary();
    reorderActivity(itinerary, { activityId: 'a2', direction: 'later' });
    expect(itinerary.days[0].activities.map((a) => a.id)).toEqual(['a1', 'a2']);
  });

  test('rejects an invalid direction', () => {
    const itinerary = makeItinerary();
    expect(() => reorderActivity(itinerary, { activityId: 'a1', direction: 'sideways' })).toThrow(
      /direction must be/,
    );
  });
});

describe('moveActivity', () => {
  test('moves the activity to the end of the target day and removes it from the source day', () => {
    const itinerary = makeItinerary();
    moveActivity(itinerary, { activityId: 'a2', toDayNumber: 2 });

    expect(itinerary.days[0].activities.map((a) => a.id)).toEqual(['a1']);
    expect(itinerary.days[1].activities.map((a) => a.id)).toEqual(['b1', 'a2']);
  });

  test('rejects moving an activity to the day it is already on', () => {
    const itinerary = makeItinerary();
    expect(() => moveActivity(itinerary, { activityId: 'a1', toDayNumber: 1 })).toThrow(
      /already on that day/,
    );
  });

  test('rejects an unknown target day', () => {
    const itinerary = makeItinerary();
    expect(() => moveActivity(itinerary, { activityId: 'a1', toDayNumber: 9 })).toThrow(
      /Day 9 does not exist/,
    );
  });
});
