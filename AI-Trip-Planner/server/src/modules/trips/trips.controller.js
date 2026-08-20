import mongoose from 'mongoose';
import { Trip, CHILD_MIN_AGE, CHILD_MAX_AGE, BUDGET_LEVELS } from './trip.model.js';
import { TravelerProfile, PACE_OPTIONS } from '../travelers/travelerProfile.model.js';
import { readProfileFields, readPreferences, readFreeText } from '../travelers/travelers.controller.js';
import { buildTravelerSnapshot } from './travelerSnapshot.js';
import { isMaterialChange, applyStaleIfMaterial } from './tripLifecycle.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { buildPlanningContext } from '../ai/planningContext.js';
import { createGeminiAdapter } from '../ai/geminiAdapter.js';
import { validateAndFinalizeItinerary } from '../ai/itineraryValidator.js';
import { recoverStaleTrip } from './staleAiOperationRecovery.js';
import {
  addActivity,
  editActivity,
  deleteActivity,
  reorderActivity,
  moveActivity,
} from './itineraryEditor.js';

const MAX_DESTINATION_LENGTH = 200;
const MAX_TRIP_TITLE_LENGTH = 100;
const MAX_HOTEL_NAME_LENGTH = 200;
const MAX_HOTEL_AREA_LENGTH = 200;
const MAX_HARD_CONSTRAINTS_LENGTH = 500;
const MAX_NOTES_LENGTH = 1000;
const MAX_MUST_DO_ITEMS = 20;
const MAX_MUST_DO_ITEM_LENGTH = 200;
const MAX_REPLAN_INSTRUCTION_LENGTH = 1000;

// Mirrors TripWizardPage.jsx's BASICS_COMPLETE_STEP: wizardStep reaching this
// value is the client's signal that the basics step was saved and the trip
// can resume on a read-only summary instead of the entry form, so the
// backend must not let it advance without the fields that summary shows.
const BASICS_COMPLETE_STEP = 2;

// F10.1: mirrors the client's QUESTIONNAIRE_COMPLETE_STEP — the review/
// readiness step comes after it, so reaching it is a readiness precondition
// rather than a wizard step of its own.
const QUESTIONNAIRE_COMPLETE_STEP = 4;

// destination/tripTitle/wizardStep: undefined means "not supplied" (left
// untouched on update); null/'' means "clear this field" — same convention
// as travelers.controller.js.
function readDestination(body) {
  if (body?.destination === undefined) return undefined;
  if (body.destination === null || body.destination === '') return null;
  const destination = typeof body.destination === 'string' ? body.destination.trim() : '';
  if (!destination || destination.length > MAX_DESTINATION_LENGTH) {
    throw new HttpError(400, 'Destination is invalid.', 'INVALID_DESTINATION');
  }
  return destination;
}

function readTripTitle(body) {
  if (body?.tripTitle === undefined) return undefined;
  if (body.tripTitle === null || body.tripTitle === '') return null;
  const tripTitle = typeof body.tripTitle === 'string' ? body.tripTitle.trim() : '';
  if (tripTitle.length > MAX_TRIP_TITLE_LENGTH) {
    throw new HttpError(400, 'Trip title is too long.', 'INVALID_TRIP_TITLE');
  }
  return tripTitle;
}

function readDate(body, field, code) {
  if (body?.[field] === undefined) return undefined;
  if (body[field] === null || body[field] === '') return null;
  const date = new Date(body[field]);
  if (Number.isNaN(date.getTime())) {
    throw new HttpError(400, `${field} is invalid.`, code);
  }
  return date;
}

function readWizardStep(body) {
  if (body?.wizardStep === undefined) return undefined;
  const wizardStep = Number(body.wizardStep);
  if (!Number.isInteger(wizardStep) || wizardStep < 1) {
    throw new HttpError(400, 'Wizard step is invalid.', 'INVALID_WIZARD_STEP');
  }
  return wizardStep;
}

function readTripFields(body) {
  return {
    destination: readDestination(body),
    startDate: readDate(body, 'startDate', 'INVALID_START_DATE'),
    endDate: readDate(body, 'endDate', 'INVALID_END_DATE'),
    tripTitle: readTripTitle(body),
    wizardStep: readWizardStep(body),
  };
}

// Dates are validated authoritatively together: only check ordering once
// both are actually present on the trip after applying this update.
function assertDateOrder(startDate, endDate) {
  if (startDate && endDate && endDate < startDate) {
    throw new HttpError(400, 'End date must be on or after the start date.', 'INVALID_DATE_RANGE');
  }
}

function assertBasicsCompleteForWizardStep(wizardStep, destination, startDate, endDate) {
  if (wizardStep >= BASICS_COMPLETE_STEP && !(destination && startDate && endDate)) {
    throw new HttpError(
      400,
      'Destination and dates are required before completing this step.',
      'INCOMPLETE_TRIP_BASICS',
    );
  }
}

// F07.2: attach/detach reusable Traveler Profiles on a Trip via the same
// PATCH endpoint used for basics, rather than trusting client-supplied
// snapshot data — the backend always looks up and re-snapshots the source
// profile itself (SYSTEM_DESIGN core rule: backend must never trust the
// frontend). Ownership of the source profile is checked here; ownership of
// the Trip itself is already enforced by loadOwnedTrip before this runs.
async function addTraveler(trip, userId, travelerProfileId) {
  if (typeof travelerProfileId !== 'string' || !mongoose.isValidObjectId(travelerProfileId)) {
    throw new HttpError(400, 'Traveler profile id is invalid.', 'INVALID_TRAVELER_PROFILE_ID');
  }

  const profile = await TravelerProfile.findOne({ _id: travelerProfileId, userId });
  if (!profile) {
    throw new HttpError(404, 'Traveler profile not found.', 'TRAVELER_PROFILE_NOT_FOUND');
  }

  const alreadyAdded = trip.tripProfile.travelers.some((traveler) =>
    traveler.sourceTravelerProfileId?.equals(profile._id),
  );
  if (alreadyAdded) {
    throw new HttpError(
      400,
      'This traveler has already been added to the trip.',
      'DUPLICATE_TRIP_TRAVELER',
    );
  }

  trip.tripProfile.travelers.push(buildTravelerSnapshot(profile));
}

// F08.1: Trip-only travelers live only inside the Trip — same planning
// fields as a snapshot (reused via readProfileFields), no TravelerProfile or
// User account created, and no sourceTravelerProfileId (that's what
// distinguishes them from attached reusable-profile travelers above).
function addTripOnlyTraveler(trip, body) {
  const fields = readProfileFields(body);
  if (!fields.travelerName) {
    throw new HttpError(400, 'Traveler name is required.', 'INVALID_TRAVELER_NAME');
  }

  trip.tripProfile.travelers.push(
    Object.fromEntries(
      Object.entries(fields).filter(([, value]) => value !== undefined && value !== null),
    ),
  );
}

function removeTraveler(trip, tripTravelerId) {
  const traveler = trip.tripProfile.travelers.id(tripTravelerId);
  if (!traveler) {
    throw new HttpError(404, 'Trip traveler not found.', 'TRIP_TRAVELER_NOT_FOUND');
  }
  traveler.deleteOne();
}

// F08.2: children are add/remove only — age is the only field, childCount is
// always derived (Trip.model.js toJSON), never independently trusted.
function addChild(trip, age) {
  const parsedAge = Number(age);
  if (!Number.isInteger(parsedAge) || parsedAge < CHILD_MIN_AGE || parsedAge > CHILD_MAX_AGE) {
    throw new HttpError(400, 'Child age is invalid.', 'INVALID_CHILD_AGE');
  }
  trip.tripProfile.children.push({ age: parsedAge });
}

function removeChild(trip, childId) {
  const child = trip.tripProfile.children.id(childId);
  if (!child) {
    throw new HttpError(404, 'Child not found.', 'CHILD_NOT_FOUND');
  }
  child.deleteOne();
}

// F09.1: undefined means "not supplied" per sub-field (left untouched),
// null/'' means "clear this field" — same convention readTripFields uses.
function readAccommodation(body) {
  if (body?.accommodation === undefined) return undefined;
  if (
    body.accommodation === null ||
    typeof body.accommodation !== 'object' ||
    Array.isArray(body.accommodation)
  ) {
    throw new HttpError(400, 'Accommodation must be an object.', 'INVALID_ACCOMMODATION');
  }
  const { hotelBooked, hotelName, hotelArea } = body.accommodation;

  let booked;
  if (hotelBooked === undefined) {
    booked = undefined;
  } else if (hotelBooked === null) {
    booked = null;
  } else if (typeof hotelBooked === 'boolean') {
    booked = hotelBooked;
  } else {
    throw new HttpError(400, 'Hotel booked flag is invalid.', 'INVALID_HOTEL_BOOKED');
  }

  let name;
  if (hotelName === undefined) {
    name = undefined;
  } else if (hotelName === null || hotelName === '') {
    name = null;
  } else {
    const value = typeof hotelName === 'string' ? hotelName.trim() : '';
    if (!value || value.length > MAX_HOTEL_NAME_LENGTH) {
      throw new HttpError(400, 'Hotel name is invalid.', 'INVALID_HOTEL_NAME');
    }
    name = value;
  }

  let area;
  if (hotelArea === undefined) {
    area = undefined;
  } else if (hotelArea === null || hotelArea === '') {
    area = null;
  } else {
    const value = typeof hotelArea === 'string' ? hotelArea.trim() : '';
    if (!value || value.length > MAX_HOTEL_AREA_LENGTH) {
      throw new HttpError(400, 'Hotel area is invalid.', 'INVALID_HOTEL_AREA');
    }
    area = value;
  }

  return {
    hotelBooked: booked,
    hotelName: name,
    hotelArea: area,
  };
}

function readBudgetLevel(body) {
  if (body?.budgetLevel === undefined) return undefined;
  if (body.budgetLevel === null || body.budgetLevel === '') return null;
  if (!BUDGET_LEVELS.includes(body.budgetLevel)) {
    throw new HttpError(400, 'Budget level is not recognized.', 'INVALID_BUDGET_LEVEL');
  }
  return body.budgetLevel;
}

function readPaceOverride(body) {
  if (body?.paceOverride === undefined) return undefined;
  if (body.paceOverride === null || body.paceOverride === '') return null;
  if (!PACE_OPTIONS.includes(body.paceOverride)) {
    throw new HttpError(400, 'Pace override is not recognized.', 'INVALID_PACE_OVERRIDE');
  }
  return body.paceOverride;
}

function readHardConstraints(body) {
  return readFreeText(body, 'hardConstraints', 'INVALID_HARD_CONSTRAINTS', MAX_HARD_CONSTRAINTS_LENGTH);
}

function readNotes(body) {
  return readFreeText(body, 'notes', 'INVALID_NOTES', MAX_NOTES_LENGTH);
}

// F09.3: mustDo[] is a full-array replace (same pattern as `preferences`),
// not a directive add/remove — free text but never treated as instructions
// by anything downstream (SYSTEM_DESIGN core rule: untrusted input stays data).
function readMustDo(body) {
  if (body?.mustDo === undefined) return undefined;
  if (!Array.isArray(body.mustDo)) {
    throw new HttpError(400, 'Must-do items must be a list.', 'INVALID_MUST_DO');
  }
  if (body.mustDo.length > MAX_MUST_DO_ITEMS) {
    throw new HttpError(400, 'Too many must-do items.', 'INVALID_MUST_DO');
  }
  const items = body.mustDo.map((item) => (typeof item === 'string' ? item.trim() : ''));
  if (items.some((item) => !item || item.length > MAX_MUST_DO_ITEM_LENGTH)) {
    throw new HttpError(400, 'Must-do items are invalid.', 'INVALID_MUST_DO');
  }
  return items;
}

function readTripProfileFields(body) {
  return {
    accommodation: readAccommodation(body),
    budgetLevel: readBudgetLevel(body),
    paceOverride: readPaceOverride(body),
    preferences: readPreferences(body),
    hardConstraints: readHardConstraints(body),
    mustDo: readMustDo(body),
    notes: readNotes(body),
  };
}

// hotelName is the only branch-dependent requirement (PRD §6.4): booked=true
// must name the hotel; every other questionnaire field stays optional, so no
// wizardStep completeness gate is added for this step (unlike basics).
function assertAccommodationConsistent(accommodation) {
  if (accommodation?.hotelBooked === true && !accommodation.hotelName) {
    throw new HttpError(
      400,
      'Hotel name is required when a hotel is already booked.',
      'HOTEL_NAME_REQUIRED',
    );
  }
}

// F10.1 (Jira ATP-56 AC): "Valid completed Trip can become
// READY_FOR_GENERATION" / "Generate action is not available until
// authoritative readiness validation passes." Backend is authoritative —
// the client's own step gating is only a UX convenience.
function assertTripReadyForGeneration(trip) {
  const missing = [];
  if (!(trip.destination && trip.startDate && trip.endDate)) missing.push('trip basics');
  if (trip.tripProfile.travelers.length === 0) missing.push('at least one traveler');
  if (trip.wizardStep < QUESTIONNAIRE_COMPLETE_STEP) missing.push('the trip questionnaire');
  if (missing.length > 0) {
    throw new HttpError(
      400,
      `Trip is not ready for generation yet: missing ${missing.join(', ')}.`,
      'TRIP_NOT_READY',
    );
  }
}

// F10.3: existing edit forms (e.g. "Save trip details") resend every field
// in their section together, not just the one the user actually touched —
// so "was this field supplied" is not the same as "did its value change".
// Only an actual value change may count toward the material-change check.
function toComparable(value) {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value.toObject === 'function') return value.toObject();
  return value;
}

function valuesDiffer(previous, next) {
  return JSON.stringify(toComparable(previous)) !== JSON.stringify(toComparable(next));
}

function applyTripProfileFields(trip, fields) {
  if (fields.accommodation !== undefined) {
    const { hotelBooked, hotelName, hotelArea } = fields.accommodation;
    if (hotelBooked !== undefined) trip.tripProfile.accommodation.hotelBooked = hotelBooked ?? undefined;
    if (hotelName !== undefined) trip.tripProfile.accommodation.hotelName = hotelName ?? undefined;
    if (hotelArea !== undefined) trip.tripProfile.accommodation.hotelArea = hotelArea ?? undefined;
  }
  assertAccommodationConsistent(trip.tripProfile.accommodation);

  for (const key of ['budgetLevel', 'paceOverride', 'preferences', 'hardConstraints', 'notes']) {
    if (fields[key] !== undefined) {
      trip.tripProfile[key] = fields[key] ?? undefined;
    }
  }
  if (fields.mustDo !== undefined) {
    trip.tripProfile.mustDo = fields.mustDo;
  }
}

export async function createTrip(req, res, next) {
  try {
    const fields = readTripFields(req.body ?? {});
    assertDateOrder(fields.startDate, fields.endDate);
    assertBasicsCompleteForWizardStep(
      fields.wizardStep ?? 1,
      fields.destination,
      fields.startDate,
      fields.endDate,
    );

    const trip = await Trip.create({
      userId: req.userId,
      ...Object.fromEntries(
        Object.entries(fields).filter(([, value]) => value !== undefined && value !== null),
      ),
    });

    res.status(201).json({ trip });
  } catch (err) {
    next(err);
  }
}

export async function listTrips(req, res, next) {
  try {
    const trips = await Trip.find({ userId: req.userId }).sort({ createdAt: -1 });
    // Self-heal any stale GENERATING/REPLANNING trips here too, not just on
    // GET /:id — otherwise the list view keeps showing a stuck status
    // indefinitely until the user opens that specific trip.
    await Promise.all(trips.map((trip) => recoverStaleTrip(trip)));
    res.status(200).json({ trips });
  } catch (err) {
    next(err);
  }
}

export function getTrip(req, res) {
  res.status(200).json({ trip: req.trip });
}

const ITINERARY_EDIT_OPERATIONS = {
  add: addActivity,
  edit: editActivity,
  delete: deleteActivity,
  reorder: reorderActivity,
  move: moveActivity,
};

// F16 (ATP-77): manual itinerary edits. Deliberately independent of the
// wizard/questionnaire/generation lifecycle — itineraryStatus/trip.status
// are untouched; only currentItinerary changes. Structural validation lives
// in itineraryEditor.js; this handler is HTTP/persistence concerns only.
export async function editItinerary(req, res, next) {
  try {
    if (!req.trip.currentItinerary) {
      throw new HttpError(400, 'This trip has no itinerary to edit yet.', 'NO_ITINERARY');
    }

    const op = ITINERARY_EDIT_OPERATIONS[req.body?.op];
    if (!op) {
      throw new HttpError(
        400,
        `op must be one of: ${Object.keys(ITINERARY_EDIT_OPERATIONS).join(', ')}.`,
        'INVALID_OP',
      );
    }

    op(req.trip.currentItinerary, req.body);
    req.trip.markModified('currentItinerary');
    await req.trip.save();
    res.status(200).json({ trip: req.trip });
  } catch (err) {
    next(err);
  }
}

export function createGenerateItineraryHandler({ geminiAdapter } = {}) {
  return async function generateItinerary(req, res, next) {
    // Release the aiConcurrencyGuard slot exactly when this handler's own
    // async work concludes — success, thrown error, or any early return —
    // regardless of the client's connection state (see aiConcurrencyGuard.js).
    try {
      return await generate(req, res, next, geminiAdapter);
    } finally {
      req.releaseAiConcurrencySlot?.();
    }
  };
}

async function generate(req, res, next, geminiAdapter) {
  if (req.trip.status !== 'READY_FOR_GENERATION') {
    return next(new HttpError(409, 'Trip is not ready for generation.', 'TRIP_NOT_READY'));
  }

  let context;
  try {
    context = buildPlanningContext(req.trip);
  } catch (err) {
    return next(err);
  }

  const previousItinerary = req.trip.currentItinerary;
  const previousItineraryStatus = req.trip.itineraryStatus;
  req.trip.status = 'GENERATING';
  req.trip.startedAt = new Date();

  try {
    await req.trip.save();
    const adapter = geminiAdapter ?? createGeminiAdapter();
    let rawOutput = await adapter.generateItinerary(context);
    let result = validateAndFinalizeItinerary(rawOutput, context);

    if (!result.valid) {
      rawOutput = await adapter.correctInvalidItinerary(context, rawOutput, result.errors);
      result = validateAndFinalizeItinerary(rawOutput, context);
    }

    if (!result.valid) throw new Error('Itinerary validation failed.');

    req.trip.currentItinerary = result.itinerary;
    req.trip.itineraryStatus = 'CURRENT';
    req.trip.status = 'PLANNED';
    req.trip.startedAt = null;
    await req.trip.save();
    return res.status(200).json({ trip: req.trip });
  } catch (err) {
    req.trip.currentItinerary = previousItinerary;
    req.trip.itineraryStatus = previousItineraryStatus;
    req.trip.status = 'READY_FOR_GENERATION';
    req.trip.startedAt = null;
    await req.trip.save();

    // Log the classification/code only — never the PlanningContext, raw
    // provider payloads, or full error detail (SYSTEM_DESIGN §7 privacy rule).
    console.error(`Itinerary generation failed for trip ${req.trip.id}: ${err.code ?? err.name ?? 'UNKNOWN'}`);

    if (err.code === 'RATE_LIMITED') {
      return next(
        new HttpError(429, 'The AI service is busy right now. Please try again shortly.', 'AI_PROVIDER_BUSY'),
      );
    }
    return next(new HttpError(502, 'Unable to generate an itinerary. Please try again.', 'ITINERARY_GENERATION_FAILED'));
  }
}

function readReplanInstruction(body) {
  const replanInstruction = typeof body?.replanInstruction === 'string' ? body.replanInstruction.trim() : '';
  if (!replanInstruction || replanInstruction.length > MAX_REPLAN_INSTRUCTION_LENGTH) {
    throw new HttpError(400, 'Replan instruction is required and must be reasonably short.', 'INVALID_REPLAN_INSTRUCTION');
  }
  return replanInstruction;
}

export function createReplanItineraryHandler({ geminiAdapter } = {}) {
  return async function replanItinerary(req, res, next) {
    // Same release-on-completion contract as generateItinerary (see
    // aiConcurrencyGuard.js) — tied to this handler's own async work, not to
    // response socket events.
    try {
      return await replan(req, res, next, geminiAdapter);
    } finally {
      req.releaseAiConcurrencySlot?.();
    }
  };
}

// F17.2/ATP-79: stateless replan — no persisted Gemini session. Every call
// rebuilds the full PlanningContext from the Trip's current persisted state,
// including currentItinerary (with any prior manual edits) and the bounded
// replanInstruction, then runs the same deterministic-validation +
// at-most-one-corrective-pass pattern generate() uses (itineraryValidator.js
// applies unchanged since context.trip is unaffected by the replan fields).
async function replan(req, res, next, geminiAdapter) {
  if (req.trip.status !== 'PLANNED' || !req.trip.currentItinerary) {
    return next(new HttpError(409, 'Trip is not ready for replanning.', 'TRIP_NOT_PLANNED'));
  }

  let replanInstruction;
  let context;
  try {
    replanInstruction = readReplanInstruction(req.body);
    context = buildPlanningContext(req.trip, {
      currentItinerary: req.trip.currentItinerary,
      replanInstruction,
    });
  } catch (err) {
    return next(err);
  }

  const previousItinerary = req.trip.currentItinerary;
  const previousItineraryStatus = req.trip.itineraryStatus;
  req.trip.status = 'REPLANNING';
  req.trip.startedAt = new Date();

  try {
    await req.trip.save();
    const adapter = geminiAdapter ?? createGeminiAdapter();
    let rawOutput = await adapter.replanItinerary(context);
    let result = validateAndFinalizeItinerary(rawOutput, context);

    if (!result.valid) {
      rawOutput = await adapter.correctInvalidItinerary(context, rawOutput, result.errors);
      result = validateAndFinalizeItinerary(rawOutput, context);
    }

    if (!result.valid) throw new Error('Itinerary validation failed.');

    req.trip.currentItinerary = result.itinerary;
    req.trip.itineraryStatus = 'CURRENT';
    req.trip.status = 'PLANNED';
    req.trip.startedAt = null;
    await req.trip.save();
    return res.status(200).json({ trip: req.trip });
  } catch (err) {
    // Failed replan preserves the prior valid CurrentItinerary/itineraryStatus
    // untouched (Jira ATP-80 AC) — never partially overwrite it.
    req.trip.currentItinerary = previousItinerary;
    req.trip.itineraryStatus = previousItineraryStatus;
    req.trip.status = 'PLANNED';
    req.trip.startedAt = null;
    await req.trip.save();

    // Log the classification/code only — never PlanningContext, raw provider
    // payloads, or full error detail (SYSTEM_DESIGN §7 privacy rule).
    console.error(`Itinerary replan failed for trip ${req.trip.id}: ${err.code ?? err.name ?? 'UNKNOWN'}`);

    if (err.code === 'RATE_LIMITED') {
      return next(
        new HttpError(429, 'The AI service is busy right now. Please try again shortly.', 'AI_PROVIDER_BUSY'),
      );
    }
    return next(new HttpError(502, 'Unable to replan the itinerary. Please try again.', 'ITINERARY_REPLAN_FAILED'));
  }
}

export async function updateTrip(req, res, next) {
  try {
    const changedFields = [];

    if (req.body?.addTravelerProfileId !== undefined) {
      await addTraveler(req.trip, req.userId, req.body.addTravelerProfileId);
      changedFields.push('travelers');
    }
    if (req.body?.addTripOnlyTraveler !== undefined) {
      addTripOnlyTraveler(req.trip, req.body.addTripOnlyTraveler);
      changedFields.push('travelers');
    }
    if (req.body?.removeTravelerId !== undefined) {
      removeTraveler(req.trip, req.body.removeTravelerId);
      changedFields.push('travelers');
    }
    if (req.body?.addChildAge !== undefined) {
      addChild(req.trip, req.body.addChildAge);
      changedFields.push('children');
    }
    if (req.body?.removeChildId !== undefined) {
      removeChild(req.trip, req.body.removeChildId);
      changedFields.push('children');
    }

    const tripProfileFields = readTripProfileFields(req.body ?? {});
    const beforeTripProfile = {
      paceOverride: req.trip.tripProfile.paceOverride,
      preferences: req.trip.tripProfile.preferences,
      hardConstraints: req.trip.tripProfile.hardConstraints,
      mustDo: req.trip.tripProfile.mustDo,
    };
    applyTripProfileFields(req.trip, tripProfileFields);
    for (const key of ['paceOverride', 'preferences', 'hardConstraints', 'mustDo']) {
      if (tripProfileFields[key] !== undefined && valuesDiffer(beforeTripProfile[key], req.trip.tripProfile[key])) {
        changedFields.push(key);
      }
    }

    const fields = readTripFields(req.body ?? {});
    const beforeDestination = req.trip.destination;
    const beforeStartDate = req.trip.startDate;
    const beforeEndDate = req.trip.endDate;

    const destination =
      fields.destination === undefined ? req.trip.destination : fields.destination;
    const startDate = fields.startDate === undefined ? req.trip.startDate : fields.startDate;
    const endDate = fields.endDate === undefined ? req.trip.endDate : fields.endDate;
    const wizardStep = fields.wizardStep === undefined ? req.trip.wizardStep : fields.wizardStep;
    assertDateOrder(startDate, endDate);
    assertBasicsCompleteForWizardStep(wizardStep, destination, startDate, endDate);

    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        req.trip[key] = value ?? undefined;
      }
    }
    if (fields.destination !== undefined && valuesDiffer(beforeDestination, req.trip.destination)) {
      changedFields.push('destination');
    }
    if (fields.startDate !== undefined && valuesDiffer(beforeStartDate, req.trip.startDate)) {
      changedFields.push('startDate');
    }
    if (fields.endDate !== undefined && valuesDiffer(beforeEndDate, req.trip.endDate)) {
      changedFields.push('endDate');
    }

    if (req.body?.markReadyForGeneration === true) {
      if (req.trip.status !== 'DRAFT') {
        throw new HttpError(
          400,
          'Only a draft trip can be marked ready for generation.',
          'TRIP_NOT_DRAFT',
        );
      }
      assertTripReadyForGeneration(req.trip);
      req.trip.status = 'READY_FOR_GENERATION';
    } else if (req.trip.status === 'READY_FOR_GENERATION' && isMaterialChange(changedFields)) {
      // A material edit after marking ready invalidates that review; the
      // user must re-review and mark ready again before generation opens up.
      req.trip.status = 'DRAFT';
    }

    applyStaleIfMaterial(req.trip, changedFields);

    await req.trip.save();
    res.status(200).json({ trip: req.trip });
  } catch (err) {
    next(err);
  }
}

export async function deleteTrip(req, res, next) {
  try {
    await req.trip.deleteOne();
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
