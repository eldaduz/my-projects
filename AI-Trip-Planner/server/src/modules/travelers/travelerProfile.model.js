import mongoose from 'mongoose';

const AGE_GROUPS = ['teen', 'adult', 'senior'];
const PACE_OPTIONS = ['relaxed', 'balanced', 'intensive'];
const WALKING_TOLERANCE_OPTIONS = ['low', 'moderate', 'high'];
const INDOOR_OUTDOOR_OPTIONS = ['indoor', 'balanced', 'outdoor'];
const PREFERENCE_VALUES = ['neutral', 'interested', 'avoid', 'block'];
const DIETARY_OPTIONS = [
  'nuts',
  'shellfish',
  'gluten',
  'dairy',
  'egg',
  'soy',
  'halal',
  'kosher',
  'vegetarian',
  'vegan',
];

// PRD §5.3-5.4: activity/category preferences plus guided tours/day trips are
// presented once, as a single consistent Neutral/Interested/Avoid/Block list
// (nightlife/shopping are not duplicated as separate fields elsewhere).
const PREFERENCE_CATEGORIES = [
  'history',
  'culture',
  'museums',
  'architecture',
  'food',
  'nightlife',
  'shopping',
  'nature',
  'beaches',
  'photography',
  'landmarks',
  'sports',
  'familyActivities',
  'guidedTours',
  'dayTrips',
];

const preferenceFields = Object.fromEntries(
  PREFERENCE_CATEGORIES.map((category) => [
    category,
    { type: String, enum: PREFERENCE_VALUES, default: 'neutral' },
  ]),
);

const preferencesSchema = new mongoose.Schema(preferenceFields, { _id: false });

const travelerProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    profileName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    travelerName: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    ageGroup: {
      type: String,
      enum: AGE_GROUPS,
    },
    pace: {
      type: String,
      enum: PACE_OPTIONS,
    },
    preferences: {
      type: preferencesSchema,
    },
    foodCuisineInterests: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    // ATP-86: structured multi-select (common allergies/dietary needs), with
    // `dietaryRequirements` below repurposed as the "other" free-text fallback.
    dietaryRestrictions: {
      type: [{ type: String, enum: DIETARY_OPTIONS }],
      default: undefined,
    },
    dietaryRequirements: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    indoorOutdoorTendency: {
      type: String,
      enum: INDOOR_OUTDOOR_OPTIONS,
    },
    walkingTolerance: {
      type: String,
      enum: WALKING_TOLERANCE_OPTIONS,
    },
    // Hard constraints (PRD §5.5) are kept separate from `preferences` —
    // mobility/accessibility/allergy/medical/prohibited-activity text that
    // Gemini must treat as must-respect rather than a soft signal.
    hardConstraints: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    travelStyleNote: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  { timestamps: true },
);

travelerProfileSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    delete ret.userId;
    if (ret.preferences) delete ret.preferences._id;
    return ret;
  },
});

export const TravelerProfile = mongoose.model('TravelerProfile', travelerProfileSchema);
export {
  AGE_GROUPS,
  PACE_OPTIONS,
  WALKING_TOLERANCE_OPTIONS,
  INDOOR_OUTDOOR_OPTIONS,
  PREFERENCE_VALUES,
  PREFERENCE_CATEGORIES,
  DIETARY_OPTIONS,
  preferencesSchema,
};
