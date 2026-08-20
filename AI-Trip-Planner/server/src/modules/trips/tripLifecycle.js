// F10.3 — SYSTEM_DESIGN §3.4: "tripTitle is non-material. Dates, travelers,
// children, pace, preferences, constraints, and must-do changes are
// material." Accommodation, budget, and notes are not listed there and are
// treated as non-material. `destination` is likewise unlisted, but changing
// the destination of a planned trip obviously invalidates any itinerary for
// the old one, so it is included here as a gap-fill on the enumeration
// rather than a deliberate deviation from it. Centralized here so both the
// controller and its unit tests share one definition (per Jira ATP-58 AC:
// "Domain logic is centralized and unit-tested").
export const MATERIAL_TRIP_FIELDS = Object.freeze(
  new Set([
    'destination',
    'startDate',
    'endDate',
    'travelers',
    'children',
    'paceOverride',
    'preferences',
    'hardConstraints',
    'mustDo',
  ]),
);

export function isMaterialChange(changedFields) {
  return changedFields.some((field) => MATERIAL_TRIP_FIELDS.has(field));
}

// Only takes effect once a CurrentItinerary exists (F13+); until then
// currentItinerary is null and this is a no-op. Never triggers regeneration
// or replanning itself — the user explicitly chooses Replan (SYSTEM_DESIGN
// §3.4), which is out of scope until F15/F17.
export function applyStaleIfMaterial(trip, changedFields) {
  if (trip.currentItinerary && isMaterialChange(changedFields)) {
    trip.itineraryStatus = 'STALE';
  }
}
