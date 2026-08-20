// PRD §5.4: interests/activity categories plus guided tours and day trips, grouped for
// readability (design/Questionnaire.dc.html). Same categories/values used by both
// TravelerProfilesPage (per-traveler preferences) and TripWizardPage (trip-level override).
export const PREFERENCE_GROUPS = [
  {
    name: 'Culture & sights',
    categories: [
      { key: 'history', label: 'History' },
      { key: 'culture', label: 'Culture' },
      { key: 'museums', label: 'Museums' },
      { key: 'architecture', label: 'Architecture' },
      { key: 'landmarks', label: 'Landmarks' },
      { key: 'photography', label: 'Photography' },
    ],
  },
  {
    name: 'Food & drink',
    categories: [
      { key: 'food', label: 'Food' },
      { key: 'nightlife', label: 'Nightlife' },
    ],
  },
  {
    name: 'Outdoors & activity',
    categories: [
      { key: 'nature', label: 'Nature' },
      { key: 'beaches', label: 'Beaches' },
      { key: 'sports', label: 'Sports' },
    ],
  },
  {
    name: 'Shopping & leisure',
    categories: [{ key: 'shopping', label: 'Shopping' }],
  },
  {
    name: 'Family & tours',
    categories: [
      { key: 'familyActivities', label: 'Family activities' },
      { key: 'guidedTours', label: 'Guided tours' },
      { key: 'dayTrips', label: 'Day trips' },
    ],
  },
];

export const PREFERENCE_CATEGORIES = PREFERENCE_GROUPS.flatMap((group) => group.categories);
