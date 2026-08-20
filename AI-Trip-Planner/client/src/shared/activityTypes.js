// Mirrors server/src/modules/ai/itineraryContract.js's ACTIVITY_TYPES/PERIODS —
// client and server are separate packages with no shared module, so this must be
// kept in sync by hand if the frozen enum ever changes.
export const ACTIVITY_TYPES = [
  'BREAKFAST',
  'LUNCH',
  'DINNER',
  'ATTRACTION',
  'MUSEUM',
  'CULTURE',
  'HISTORY',
  'ARCHITECTURE',
  'FOOD',
  'NATURE',
  'SHOPPING',
  'NIGHTLIFE',
  'BEACH',
  'SPORT',
  'FAMILY',
  'TOUR',
  'FREE_TIME',
  'TRANSPORT',
  'OTHER',
];

export const PERIODS = ['MORNING', 'AFTERNOON', 'EVENING'];
