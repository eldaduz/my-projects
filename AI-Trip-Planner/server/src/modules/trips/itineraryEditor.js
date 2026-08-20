// F16 (ATP-21/ATP-77): manual edit operations on a persisted CurrentItinerary.
// Centralized here, independent of the controller, so state-transition
// correctness can be unit-tested directly (same pattern as tripLifecycle.js).
//
// Deliberately bypasses itineraryValidator.js's AI capacity checks (max
// activities/day, max active minutes/day) — F16.1 AC: a user intentionally
// overloading a day with manual edits is allowed. Only structural integrity
// (required fields, controlled enums, duration bounds) is enforced here.
import crypto from 'node:crypto';
import { HttpError } from '../../middleware/errorHandler.js';
import { ACTIVITY_TYPES, PERIODS, ACTIVITY_DURATION_BOUNDS } from '../ai/itineraryContract.js';

const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 1000;
const MAX_LOCATION_LENGTH = 200;

// transferBeforeMinutes is a system planning estimate, not a user-edit field
// (F16.1 AC) — manually added activities get 0 rather than a fabricated guess.
const MANUAL_TRANSFER_BEFORE_MINUTES = 0;

function findDay(itinerary, dayNumber) {
  const day = itinerary.days?.find((d) => d.dayNumber === dayNumber);
  if (!day) {
    throw new HttpError(400, `Day ${dayNumber} does not exist on this itinerary.`, 'INVALID_DAY');
  }
  return day;
}

function findActivityLocation(itinerary, activityId) {
  for (const day of itinerary.days ?? []) {
    const index = day.activities.findIndex((activity) => activity.id === activityId);
    if (index !== -1) return { day, index };
  }
  throw new HttpError(404, 'Activity not found.', 'ACTIVITY_NOT_FOUND');
}

function validateActivityFields({ title, description, location, type, durationMinutes }) {
  if (typeof title !== 'string' || !title.trim() || title.length > MAX_TITLE_LENGTH) {
    throw new HttpError(400, 'Activity title is required.', 'INVALID_ACTIVITY_TITLE');
  }
  if (
    typeof description !== 'string' ||
    !description.trim() ||
    description.length > MAX_DESCRIPTION_LENGTH
  ) {
    throw new HttpError(400, 'Activity description is required.', 'INVALID_ACTIVITY_DESCRIPTION');
  }
  if (typeof location !== 'string' || !location.trim() || location.length > MAX_LOCATION_LENGTH) {
    throw new HttpError(400, 'Activity location is required.', 'INVALID_ACTIVITY_LOCATION');
  }
  if (!ACTIVITY_TYPES.includes(type)) {
    throw new HttpError(
      400,
      `Activity type must be one of: ${ACTIVITY_TYPES.join(', ')}.`,
      'INVALID_ACTIVITY_TYPE',
    );
  }
  if (
    typeof durationMinutes !== 'number' ||
    !Number.isInteger(durationMinutes) ||
    durationMinutes < ACTIVITY_DURATION_BOUNDS.minMinutes ||
    durationMinutes > ACTIVITY_DURATION_BOUNDS.maxMinutes
  ) {
    throw new HttpError(
      400,
      `Activity duration must be an integer between ${ACTIVITY_DURATION_BOUNDS.minMinutes} and ${ACTIVITY_DURATION_BOUNDS.maxMinutes} minutes.`,
      'INVALID_ACTIVITY_DURATION',
    );
  }
  return { title: title.trim(), description: description.trim(), location: location.trim(), type, durationMinutes };
}

// F16.1: add an activity to a day the user chooses.
export function addActivity(itinerary, { dayNumber, activity }) {
  const day = findDay(itinerary, dayNumber);
  const fields = validateActivityFields(activity ?? {});

  if (!PERIODS.includes(activity?.period)) {
    throw new HttpError(400, `period must be one of: ${PERIODS.join(', ')}.`, 'INVALID_PERIOD');
  }

  day.activities.push({
    id: crypto.randomUUID(),
    period: activity.period,
    ...fields,
    transferBeforeMinutes: MANUAL_TRANSFER_BEFORE_MINUTES,
  });
}

// F16.1: edit title/description/location/type/durationMinutes. period,
// transferBeforeMinutes and id are not user-edit fields and stay untouched.
export function editActivity(itinerary, { activityId, updates }) {
  const { day, index } = findActivityLocation(itinerary, activityId);
  const fields = validateActivityFields(updates ?? {});
  day.activities[index] = { ...day.activities[index], ...fields };
}

// F16.1: delete an activity intentionally.
export function deleteActivity(itinerary, { activityId }) {
  const { day, index } = findActivityLocation(itinerary, activityId);
  day.activities.splice(index, 1);
}

// F16.2: swap an activity with its immediate neighbor within the same day.
// A request at the boundary (already first/last) is a no-op, not an error —
// the UI's earlier/later buttons are expected to disable there, but a stale
// client retrying the request shouldn't fail.
export function reorderActivity(itinerary, { activityId, direction }) {
  if (direction !== 'earlier' && direction !== 'later') {
    throw new HttpError(400, 'direction must be "earlier" or "later".', 'INVALID_DIRECTION');
  }
  const { day, index } = findActivityLocation(itinerary, activityId);
  const targetIndex = direction === 'earlier' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= day.activities.length) return;

  [day.activities[index], day.activities[targetIndex]] = [
    day.activities[targetIndex],
    day.activities[index],
  ];
}

// F16.2: move an activity to a different day, appended at the end of that day.
export function moveActivity(itinerary, { activityId, toDayNumber }) {
  const { day: fromDay, index } = findActivityLocation(itinerary, activityId);
  const toDay = findDay(itinerary, toDayNumber);
  if (fromDay.dayNumber === toDayNumber) {
    throw new HttpError(400, 'Activity is already on that day.', 'INVALID_MOVE');
  }

  const [activity] = fromDay.activities.splice(index, 1);
  toDay.activities.push(activity);
}
