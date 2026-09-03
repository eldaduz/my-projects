const SNAPSHOT_FIELDS = [
  'ageGroup',
  'pace',
  'preferences',
  'foodCuisineInterests',
  'dietaryRestrictions',
  'dietaryRequirements',
  'indoorOutdoorTendency',
  'walkingTolerance',
  'hardConstraints',
  'travelStyleNote',
];

// F07.1: builds a frozen copy of a TravelerProfile's planning-relevant fields
// for embedding in a Trip. Called once, at attach-time — the result is never
// re-derived from the source profile again (SYSTEM_DESIGN §3.2/§4).
export function buildTravelerSnapshot(profile) {
  const snapshot = {
    sourceTravelerProfileId: profile._id,
    travelerName: profile.profileName,
  };
  for (const field of SNAPSHOT_FIELDS) {
    const value = profile[field];
    if (value !== undefined) snapshot[field] = value;
  }
  return snapshot;
}
