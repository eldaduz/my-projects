import mongoose from 'mongoose';
import {
  preferencesSchema,
  AGE_GROUPS,
  PACE_OPTIONS,
  WALKING_TOLERANCE_OPTIONS,
  INDOOR_OUTDOOR_OPTIONS,
  DIETARY_OPTIONS,
} from '../travelers/travelerProfile.model.js';

// DRAFT is the only status this Feature (F06) creates/transitions. Later
// Features (F10+) add READY_FOR_GENERATION/GENERATING/PLANNED/REPLANNING
// per SYSTEM_DESIGN §3.4 — the enum lists them now so the lifecycle field
// doesn't need a migration when those Features land.
const TRIP_STATUSES = ['DRAFT', 'READY_FOR_GENERATION', 'GENERATING', 'PLANNED', 'REPLANNING'];
const ITINERARY_STATUSES = ['CURRENT', 'STALE'];

// F07/F08: a frozen copy of a TravelerProfile's planning-relevant fields,
// taken at attach-time. sourceTravelerProfileId is provenance only
// (SYSTEM_DESIGN §4) — later edits/deletion of the reusable profile never
// touch this snapshot. Trip-only travelers (F08.1) use this same schema but
// omit sourceTravelerProfileId — they only ever live inside the Trip.
// Trip-level pace/preference/constraint overrides (SYSTEM_DESIGN §3.2/§3.3)
// live on tripProfileSchema below (F09/ATP-14), not on this per-traveler schema.
const tripTravelerSchema = new mongoose.Schema(
  {
    sourceTravelerProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TravelerProfile',
    },
    travelerName: { type: String, trim: true, maxlength: 100 },
    ageGroup: { type: String, enum: AGE_GROUPS },
    pace: { type: String, enum: PACE_OPTIONS },
    preferences: { type: preferencesSchema },
    foodCuisineInterests: { type: String, trim: true, maxlength: 500 },
    dietaryRestrictions: { type: [{ type: String, enum: DIETARY_OPTIONS }], default: undefined },
    dietaryRequirements: { type: String, trim: true, maxlength: 500 },
    indoorOutdoorTendency: { type: String, enum: INDOOR_OUTDOOR_OPTIONS },
    walkingTolerance: { type: String, enum: WALKING_TOLERANCE_OPTIONS },
    hardConstraints: { type: String, trim: true, maxlength: 500 },
    travelStyleNote: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true },
);

tripTravelerSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    if (ret.preferences) delete ret.preferences._id;
    return ret;
  },
});

const CHILD_MIN_AGE = 0;
const CHILD_MAX_AGE = 17;

// F08.2: children are not full Traveler Profiles (SYSTEM_DESIGN §3.2) — just
// an age. childCount is derived from array length at serialization time
// (toJSON transform below), never stored as its own field.
const tripChildSchema = new mongoose.Schema(
  {
    age: { type: Number, required: true, min: CHILD_MIN_AGE, max: CHILD_MAX_AGE },
  },
  { timestamps: true },
);

tripChildSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

const BUDGET_LEVELS = ['budget', 'moderate', 'premium'];

// F09.1: hotel-booked branching (SYSTEM_DESIGN §3.3 accommodation). hotelName
// is required only when hotelBooked is true; hotelArea doubles as "address/
// area" (booked) or "preferred area/neighborhood style" (not booked) per
// PRD §6.4 — no live search/booking capability is introduced.
const accommodationSchema = new mongoose.Schema(
  {
    hotelBooked: { type: Boolean },
    hotelName: { type: String, trim: true, maxlength: 200 },
    hotelArea: { type: String, trim: true, maxlength: 200 },
  },
  { _id: false },
);

// F09: the trip-level questionnaire/override fields (SYSTEM_DESIGN §3.3).
// `preferences`/`hardConstraints` here are trip-wide overrides distinct from
// each traveler's own fields on tripTravelerSchema above — PRD §6.6 describes
// a single trip-level classification, not a per-traveler override.
const tripProfileSchema = new mongoose.Schema(
  {
    travelers: { type: [tripTravelerSchema], default: [] },
    children: { type: [tripChildSchema], default: [] },
    accommodation: { type: accommodationSchema, default: () => ({}) },
    budgetLevel: { type: String, enum: BUDGET_LEVELS },
    paceOverride: { type: String, enum: PACE_OPTIONS },
    preferences: { type: preferencesSchema },
    hardConstraints: { type: String, trim: true, maxlength: 500 },
    mustDo: { type: [String], default: [] },
    notes: { type: String, trim: true, maxlength: 1000 },
  },
  { _id: false },
);

const tripSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: TRIP_STATUSES,
      default: 'DRAFT',
    },
    startedAt: {
      type: Date,
      default: null,
    },
    // F10.3 (SYSTEM_DESIGN §3.4): separate from lifecycle `status`. Stays null
    // until a CurrentItinerary exists (F13+); a material TripProfile/date
    // change after that sets it to STALE instead of touching currentItinerary.
    itineraryStatus: {
      type: String,
      enum: ITINERARY_STATUSES,
      default: null,
    },
    wizardStep: {
      type: Number,
      default: 1,
      min: 1,
    },
    destination: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
    tripTitle: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    // F13+ populate currentItinerary; tripProfile's real shape (SYSTEM_DESIGN
    // §3.3) is filled in incrementally by F07-F09.
    tripProfile: {
      type: tripProfileSchema,
      default: () => ({}),
    },
    currentItinerary: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true },
);

tripSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    delete ret.userId;
    if (ret.startDate && ret.endDate) {
      ret.duration = Math.round((ret.endDate - ret.startDate) / 86400000) + 1;
    }
    if (ret.tripProfile) {
      ret.tripProfile.childCount = ret.tripProfile.children.length;
    }
    return ret;
  },
});

export const Trip = mongoose.model('Trip', tripSchema);
export { TRIP_STATUSES, ITINERARY_STATUSES, CHILD_MIN_AGE, CHILD_MAX_AGE, BUDGET_LEVELS };
