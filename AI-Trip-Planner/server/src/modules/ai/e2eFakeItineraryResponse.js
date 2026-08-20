import { PERIODS } from './itineraryContract.js';

const PERIOD_ACTIVITY = {
  MORNING: { type: 'BREAKFAST', title: 'Breakfast', description: 'A relaxed morning meal.', durationMinutes: 45 },
  AFTERNOON: { type: 'ATTRACTION', title: 'City exploration', description: 'A self-guided walk through the area.', durationMinutes: 120 },
  EVENING: { type: 'DINNER', title: 'Dinner', description: 'An evening meal.', durationMinutes: 60 },
};

function addDays(dateStr, offset) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

// E2E-only deterministic Gemini stand-in. Generated as a function of the real
// PlanningContext (not a static fixture) so it satisfies itineraryValidator.js's
// day-count/date/dayNumber checks for whatever dates the E2E spec picks in the
// wizard, without needing the spec and a fixture file to stay in lockstep.
export function buildFakeItineraryResponse(context) {
  const { destination, startDate, duration } = context.trip;

  const days = Array.from({ length: duration }, (_, index) => ({
    dayNumber: index + 1,
    date: addDays(startDate, index),
    title: `Day ${index + 1}`,
    summary: `A sample day exploring ${destination}.`,
    activities: PERIODS.map((period, activityIndex) => ({
      ...PERIOD_ACTIVITY[period],
      location: destination,
      period,
      transferBeforeMinutes: activityIndex === 0 ? 0 : 15,
    })),
  }));

  return JSON.stringify({ destination, days });
}
