import {
  PERIODS,
  ACTIVITY_TYPES,
  PREFERENCE_CATEGORY_ACTIVITY_TYPE_MAP,
  PACE_CAPACITY_CONFIG,
  ACTIVITY_DURATION_BOUNDS,
  ACTIVITY_TRANSFER_BOUNDS,
  resolveEffectivePace,
  parseRawItineraryJson,
  assignActivityIds,
} from './itineraryContract.js';

const PERIOD_INDEX = Object.freeze({
  MORNING: 0,
  AFTERNOON: 1,
  EVENING: 2,
});

function getExpectedDate(startDateStr, dayIndex) {
  if (typeof startDateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(startDateStr)) {
    return null;
  }
  const [year, month, day] = startDateStr.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day + dayIndex));
  return d.toISOString().slice(0, 10);
}

function collectBlockedCategories(context) {
  const blocked = new Set();

  if (context?.preferences && typeof context.preferences === 'object') {
    for (const [category, val] of Object.entries(context.preferences)) {
      if (val === 'block') {
        blocked.add(category);
      }
    }
  }

  if (Array.isArray(context?.travelers)) {
    for (const traveler of context.travelers) {
      if (traveler?.preferences && typeof traveler.preferences === 'object') {
        for (const [category, val] of Object.entries(traveler.preferences)) {
          if (val === 'block') {
            blocked.add(category);
          }
        }
      }
    }
  }

  return blocked;
}

/**
 * Validates a parsed itinerary against the trip PlanningContext and frozen domain contracts.
 * Returns { valid: boolean, errors: Array<{ code, message, path, details? }> }.
 */
export function validateItinerary(itinerary, context = {}) {
  const errors = [];

  // 1. Root schema validation
  if (!itinerary || typeof itinerary !== 'object' || Array.isArray(itinerary)) {
    return {
      valid: false,
      errors: [
        {
          code: 'SCHEMA_INVALID',
          message: 'Itinerary output must be a non-null object.',
          path: '',
        },
      ],
    };
  }

  if (typeof itinerary.destination !== 'string' || !itinerary.destination.trim()) {
    errors.push({
      code: 'SCHEMA_INVALID',
      message: 'Itinerary destination is required and must be a non-empty string.',
      path: 'destination',
    });
  }
  // No cross-check against context.trip.destination: SYSTEM_DESIGN.md §6.4 scopes deterministic
  // validation to schema/JSON, day count/dates, enums, duration sanity, capacity, and BLOCK
  // conflicts — not destination-string equality. A string-matching check can't distinguish a
  // valid region/city answer (trip "Japan" vs itinerary "Tokyo") from a genuinely wrong one
  // without real geographic knowledge, so it would only produce false rejections, never catch a
  // real error reliably.

  if (!Array.isArray(itinerary.days) || itinerary.days.length === 0) {
    errors.push({
      code: 'SCHEMA_INVALID',
      message: 'Itinerary must contain a non-empty "days" array.',
      path: 'days',
    });
    return { valid: false, errors };
  }

  // 2. Day count validation
  const expectedDuration = context?.trip?.duration;
  if (typeof expectedDuration === 'number' && itinerary.days.length !== expectedDuration) {
    errors.push({
      code: 'DAY_COUNT_MISMATCH',
      message: `Itinerary day count (${itinerary.days.length}) does not match expected trip duration (${expectedDuration}).`,
      path: 'days',
      details: { expected: expectedDuration, actual: itinerary.days.length },
    });
  }

  // Pace and capacity resolution
  const effectivePace = resolveEffectivePace(context);
  const paceConfig = PACE_CAPACITY_CONFIG[effectivePace] ?? PACE_CAPACITY_CONFIG.balanced;
  const blockedCategories = collectBlockedCategories(context);

  // 3. Day-by-day validation
  const startDateStr = context?.trip?.startDate;

  itinerary.days.forEach((day, dayIndex) => {
    const dayPath = `days[${dayIndex}]`;

    if (!day || typeof day !== 'object' || Array.isArray(day)) {
      errors.push({
        code: 'DAY_SCHEMA_INVALID',
        message: `Day at index ${dayIndex} must be an object.`,
        path: dayPath,
      });
      return;
    }

    const expectedDayNumber = dayIndex + 1;
    // Gemini's response has no responseSchema enforcing numeric types, so a numerically-correct
    // dayNumber can legally arrive as a string (e.g. "1"); coerce before comparing so that case
    // isn't rejected, while a genuinely wrong or non-numeric value still fails.
    const actualDayNumber = typeof day.dayNumber === 'string' ? Number(day.dayNumber) : day.dayNumber;
    if (!Number.isFinite(actualDayNumber) || actualDayNumber !== expectedDayNumber) {
      errors.push({
        code: 'DAY_NUMBER_MISMATCH',
        message: `Day at index ${dayIndex} has dayNumber ${day.dayNumber}, expected ${expectedDayNumber}.`,
        path: `${dayPath}.dayNumber`,
        details: { expected: expectedDayNumber, actual: day.dayNumber },
      });
    }

    if (startDateStr) {
      const expectedDate = getExpectedDate(startDateStr, dayIndex);
      if (expectedDate && day.date !== expectedDate) {
        errors.push({
          code: 'DATE_MISMATCH',
          message: `Day ${expectedDayNumber} date "${day.date}" does not match expected date "${expectedDate}".`,
          path: `${dayPath}.date`,
          details: { expected: expectedDate, actual: day.date },
        });
      }
    }

    if (typeof day.title !== 'string' || !day.title.trim()) {
      errors.push({
        code: 'DAY_SCHEMA_INVALID',
        message: `Day ${expectedDayNumber} title is required.`,
        path: `${dayPath}.title`,
      });
    }

    if (typeof day.summary !== 'string' || !day.summary.trim()) {
      errors.push({
        code: 'DAY_SCHEMA_INVALID',
        message: `Day ${expectedDayNumber} summary is required.`,
        path: `${dayPath}.summary`,
      });
    }

    if (!Array.isArray(day.activities) || day.activities.length === 0) {
      errors.push({
        code: 'DAY_SCHEMA_INVALID',
        message: `Day ${expectedDayNumber} must contain a non-empty activities array.`,
        path: `${dayPath}.activities`,
      });
      return;
    }

    // Capacity check: Max activities per day
    if (day.activities.length > paceConfig.maxActivitiesPerDay) {
      errors.push({
        code: 'CAPACITY_EXCEEDED',
        message: `Day ${expectedDayNumber} has ${day.activities.length} activities, exceeding the ${effectivePace} pace limit of ${paceConfig.maxActivitiesPerDay} activities.`,
        path: `${dayPath}.activities`,
        details: {
          dayNumber: expectedDayNumber,
          pace: effectivePace,
          limit: paceConfig.maxActivitiesPerDay,
          actual: day.activities.length,
        },
      });
    }

    let dailyActiveMinutes = 0;
    let lastPeriodIndex = -1;

    // 4. Activity-by-activity validation
    day.activities.forEach((activity, actIndex) => {
      const actPath = `${dayPath}.activities[${actIndex}]`;

      if (!activity || typeof activity !== 'object' || Array.isArray(activity)) {
        errors.push({
          code: 'ACTIVITY_SCHEMA_INVALID',
          message: `Activity at index ${actIndex} on day ${expectedDayNumber} must be an object.`,
          path: actPath,
        });
        return;
      }

      // Check activity type enum
      if (!ACTIVITY_TYPES.includes(activity.type)) {
        errors.push({
          code: 'INVALID_ENUM',
          message: `Activity "${activity.title ?? actIndex}" has invalid type "${activity.type}". Allowed: ${ACTIVITY_TYPES.join(', ')}.`,
          path: `${actPath}.type`,
          details: { field: 'type', value: activity.type, allowed: ACTIVITY_TYPES },
        });
      }

      // Check period enum
      if (!PERIODS.includes(activity.period)) {
        errors.push({
          code: 'INVALID_ENUM',
          message: `Activity "${activity.title ?? actIndex}" has invalid period "${activity.period}". Allowed: ${PERIODS.join(', ')}.`,
          path: `${actPath}.period`,
          details: { field: 'period', value: activity.period, allowed: PERIODS },
        });
      } else {
        // Chronological period ordering check
        const currentPeriodIdx = PERIOD_INDEX[activity.period];
        if (currentPeriodIdx < lastPeriodIndex) {
          errors.push({
            code: 'PERIOD_ORDER_INVALID',
            message: `Activity "${activity.title ?? actIndex}" with period ${activity.period} appears out of chronological order on day ${expectedDayNumber}.`,
            path: `${actPath}.period`,
            details: { dayNumber: expectedDayNumber, period: activity.period },
          });
        } else {
          lastPeriodIndex = currentPeriodIdx;
        }
      }

      // Required string fields
      for (const strField of ['title', 'description', 'location']) {
        if (typeof activity[strField] !== 'string' || !activity[strField].trim()) {
          errors.push({
            code: 'ACTIVITY_SCHEMA_INVALID',
            message: `Activity at index ${actIndex} on day ${expectedDayNumber} is missing required string field "${strField}".`,
            path: `${actPath}.${strField}`,
          });
        }
      }

      // Duration bounds sanity
      if (
        typeof activity.durationMinutes !== 'number' ||
        !Number.isInteger(activity.durationMinutes) ||
        activity.durationMinutes < ACTIVITY_DURATION_BOUNDS.minMinutes ||
        activity.durationMinutes > ACTIVITY_DURATION_BOUNDS.maxMinutes
      ) {
        errors.push({
          code: 'DURATION_OUT_OF_BOUNDS',
          message: `Activity "${activity.title ?? actIndex}" durationMinutes (${activity.durationMinutes}) must be an integer between ${ACTIVITY_DURATION_BOUNDS.minMinutes} and ${ACTIVITY_DURATION_BOUNDS.maxMinutes}.`,
          path: `${actPath}.durationMinutes`,
          details: {
            min: ACTIVITY_DURATION_BOUNDS.minMinutes,
            max: ACTIVITY_DURATION_BOUNDS.maxMinutes,
            actual: activity.durationMinutes,
          },
        });
      } else {
        dailyActiveMinutes += activity.durationMinutes;
      }

      // Transfer bounds sanity
      if (
        typeof activity.transferBeforeMinutes !== 'number' ||
        !Number.isInteger(activity.transferBeforeMinutes) ||
        activity.transferBeforeMinutes < ACTIVITY_TRANSFER_BOUNDS.minMinutes ||
        activity.transferBeforeMinutes > ACTIVITY_TRANSFER_BOUNDS.maxMinutes
      ) {
        errors.push({
          code: 'TRANSFER_OUT_OF_BOUNDS',
          message: `Activity "${activity.title ?? actIndex}" transferBeforeMinutes (${activity.transferBeforeMinutes}) must be an integer between ${ACTIVITY_TRANSFER_BOUNDS.minMinutes} and ${ACTIVITY_TRANSFER_BOUNDS.maxMinutes}.`,
          path: `${actPath}.transferBeforeMinutes`,
          details: {
            min: ACTIVITY_TRANSFER_BOUNDS.minMinutes,
            max: ACTIVITY_TRANSFER_BOUNDS.maxMinutes,
            actual: activity.transferBeforeMinutes,
          },
        });
      } else {
        dailyActiveMinutes += activity.transferBeforeMinutes;
      }

      // BLOCK category conflicts check
      if (activity.type) {
        for (const blockedCat of blockedCategories) {
          const mappedTypes = PREFERENCE_CATEGORY_ACTIVITY_TYPE_MAP[blockedCat];
          if (mappedTypes && mappedTypes.includes(activity.type)) {
            errors.push({
              code: 'BLOCK_CONFLICT',
              message: `Activity "${activity.title}" (type: ${activity.type}) violates blocked preference category "${blockedCat}".`,
              path: `${actPath}.type`,
              details: {
                category: blockedCat,
                activityType: activity.type,
                activityTitle: activity.title,
                dayNumber: expectedDayNumber,
              },
            });
          }
        }
      }
    });

    // Capacity check: Max daily active scheduled minutes
    if (dailyActiveMinutes > paceConfig.maxActiveMinutesPerDay) {
      errors.push({
        code: 'CAPACITY_EXCEEDED',
        message: `Day ${expectedDayNumber} has ${dailyActiveMinutes} minutes of active scheduled time, exceeding the ${effectivePace} pace limit of ${paceConfig.maxActiveMinutesPerDay} minutes.`,
        path: `${dayPath}.activities`,
        details: {
          dayNumber: expectedDayNumber,
          pace: effectivePace,
          limit: paceConfig.maxActiveMinutesPerDay,
          actual: dailyActiveMinutes,
        },
      });
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates raw AI output (string or object) against the planning context.
 * If valid, returns { valid: true, itinerary: <with backend activity IDs>, errors: [] }.
 * If invalid, returns { valid: false, itinerary: null, errors: [...] }.
 */
export function validateAndFinalizeItinerary(rawOutput, context) {
  let parsed;
  try {
    parsed = parseRawItineraryJson(rawOutput);
  } catch (err) {
    return {
      valid: false,
      itinerary: null,
      errors: [
        {
          code: 'JSON_PARSE_ERROR',
          message: err.message,
          path: '',
        },
      ],
    };
  }

  const validationResult = validateItinerary(parsed, context);
  if (!validationResult.valid) {
    return {
      valid: false,
      itinerary: null,
      errors: validationResult.errors,
    };
  }

  return {
    valid: true,
    itinerary: assignActivityIds(parsed),
    errors: [],
  };
}
