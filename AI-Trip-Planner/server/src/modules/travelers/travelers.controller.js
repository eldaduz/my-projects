import {
  TravelerProfile,
  AGE_GROUPS,
  PACE_OPTIONS,
  WALKING_TOLERANCE_OPTIONS,
  INDOOR_OUTDOOR_OPTIONS,
  PREFERENCE_VALUES,
  PREFERENCE_CATEGORIES,
  DIETARY_OPTIONS,
} from './travelerProfile.model.js';
import { HttpError } from '../../middleware/errorHandler.js';

const MAX_PROFILE_NAME_LENGTH = 100;
const MAX_TRAVELER_NAME_LENGTH = 100;
const MAX_FREE_TEXT_LENGTH = 500;

function readProfileName(body) {
  const profileName = typeof body?.profileName === 'string' ? body.profileName.trim() : '';
  if (!profileName || profileName.length > MAX_PROFILE_NAME_LENGTH) {
    throw new HttpError(400, 'Profile name is required.', 'INVALID_PROFILE_NAME');
  }
  return profileName;
}

// travelerName/ageGroup/etc are optional: `undefined` means "field not supplied"
// (left untouched on update), while `null` means "clear this field".
function readTravelerName(body) {
  if (body?.travelerName === undefined) return undefined;
  const travelerName = typeof body.travelerName === 'string' ? body.travelerName.trim() : '';
  if (travelerName.length > MAX_TRAVELER_NAME_LENGTH) {
    throw new HttpError(400, 'Traveler name is too long.', 'INVALID_TRAVELER_NAME');
  }
  return travelerName || null;
}

function readAgeGroup(body) {
  if (body?.ageGroup === undefined) return undefined;
  if (body.ageGroup === null || body.ageGroup === '') return null;
  if (!AGE_GROUPS.includes(body.ageGroup)) {
    throw new HttpError(400, 'Age group is not recognized.', 'INVALID_AGE_GROUP');
  }
  return body.ageGroup;
}

function readPace(body) {
  if (body?.pace === undefined) return undefined;
  if (body.pace === null || body.pace === '') return null;
  if (!PACE_OPTIONS.includes(body.pace)) {
    throw new HttpError(400, 'Pace is not recognized.', 'INVALID_PACE');
  }
  return body.pace;
}

function readWalkingTolerance(body) {
  if (body?.walkingTolerance === undefined) return undefined;
  if (body.walkingTolerance === null || body.walkingTolerance === '') return null;
  if (!WALKING_TOLERANCE_OPTIONS.includes(body.walkingTolerance)) {
    throw new HttpError(400, 'Walking tolerance is not recognized.', 'INVALID_WALKING_TOLERANCE');
  }
  return body.walkingTolerance;
}

function readIndoorOutdoorTendency(body) {
  if (body?.indoorOutdoorTendency === undefined) return undefined;
  if (body.indoorOutdoorTendency === null || body.indoorOutdoorTendency === '') return null;
  if (!INDOOR_OUTDOOR_OPTIONS.includes(body.indoorOutdoorTendency)) {
    throw new HttpError(
      400,
      'Indoor/outdoor tendency is not recognized.',
      'INVALID_INDOOR_OUTDOOR_TENDENCY',
    );
  }
  return body.indoorOutdoorTendency;
}

function readFreeText(body, field, code, maxLength = MAX_FREE_TEXT_LENGTH) {
  if (body?.[field] === undefined) return undefined;
  if (body[field] === null || body[field] === '') return null;
  const value = typeof body[field] === 'string' ? body[field].trim() : '';
  if (!value || value.length > maxLength) {
    throw new HttpError(400, `${field} is invalid.`, code);
  }
  return value;
}

function readPreferences(body) {
  if (body?.preferences === undefined) return undefined;
  if (body.preferences === null) return null;
  if (typeof body.preferences !== 'object' || Array.isArray(body.preferences)) {
    throw new HttpError(400, 'Preferences must be an object.', 'INVALID_PREFERENCES');
  }

  const preferences = {};
  for (const [category, value] of Object.entries(body.preferences)) {
    if (!PREFERENCE_CATEGORIES.includes(category)) {
      throw new HttpError(400, `Unknown preference category "${category}".`, 'INVALID_PREFERENCES');
    }
    if (!PREFERENCE_VALUES.includes(value)) {
      throw new HttpError(
        400,
        `Invalid preference value for "${category}".`,
        'INVALID_PREFERENCES',
      );
    }
    preferences[category] = value;
  }
  return preferences;
}

function readDietaryRestrictions(body) {
  if (body?.dietaryRestrictions === undefined) return undefined;
  if (body.dietaryRestrictions === null) return null;
  if (!Array.isArray(body.dietaryRestrictions)) {
    throw new HttpError(400, 'Dietary restrictions must be a list.', 'INVALID_DIETARY_RESTRICTIONS');
  }
  const restrictions = [...new Set(body.dietaryRestrictions)];
  for (const value of restrictions) {
    if (!DIETARY_OPTIONS.includes(value)) {
      throw new HttpError(
        400,
        `Unknown dietary restriction "${value}".`,
        'INVALID_DIETARY_RESTRICTIONS',
      );
    }
  }
  return restrictions.length ? restrictions : null;
}

function readProfileFields(body) {
  return {
    travelerName: readTravelerName(body),
    ageGroup: readAgeGroup(body),
    pace: readPace(body),
    preferences: readPreferences(body),
    foodCuisineInterests: readFreeText(
      body,
      'foodCuisineInterests',
      'INVALID_FOOD_CUISINE_INTERESTS',
    ),
    dietaryRestrictions: readDietaryRestrictions(body),
    dietaryRequirements: readFreeText(body, 'dietaryRequirements', 'INVALID_DIETARY_REQUIREMENTS'),
    indoorOutdoorTendency: readIndoorOutdoorTendency(body),
    walkingTolerance: readWalkingTolerance(body),
    hardConstraints: readFreeText(body, 'hardConstraints', 'INVALID_HARD_CONSTRAINTS'),
    travelStyleNote: readFreeText(body, 'travelStyleNote', 'INVALID_TRAVEL_STYLE_NOTE'),
  };
}

// Exported for reuse by trips.controller.js: readProfileFields (F08.1) —
// Trip-only travelers use the same planning-relevant fields as reusable-
// profile snapshots. readPreferences (F09) — trip-level preference overrides
// use the same Neutral/Interested/Avoid/Block validation. readFreeText (F09)
// — trip-level hardConstraints/notes reuse the same trim/bounds validation.
export { readProfileFields, readPreferences, readFreeText };

export async function createProfile(req, res, next) {
  try {
    const profileName = readProfileName(req.body);
    const fields = readProfileFields(req.body);

    const profile = await TravelerProfile.create({
      userId: req.userId,
      profileName,
      ...Object.fromEntries(Object.entries(fields).filter(([, value]) => value)),
    });

    res.status(201).json({ profile });
  } catch (err) {
    next(err);
  }
}

export async function listProfiles(req, res, next) {
  try {
    const profiles = await TravelerProfile.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.status(200).json({ profiles });
  } catch (err) {
    next(err);
  }
}

export function getProfile(req, res) {
  res.status(200).json({ profile: req.profile });
}

export async function updateProfile(req, res, next) {
  try {
    if (req.body?.profileName !== undefined) {
      req.profile.profileName = readProfileName(req.body);
    }

    const fields = readProfileFields(req.body);
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        req.profile[key] = value ?? undefined;
      }
    }

    await req.profile.save();
    res.status(200).json({ profile: req.profile });
  } catch (err) {
    next(err);
  }
}

export async function deleteProfile(req, res, next) {
  try {
    await req.profile.deleteOne();
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
