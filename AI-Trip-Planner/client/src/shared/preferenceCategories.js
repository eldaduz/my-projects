// PRD §5.4: interests/activity categories plus guided tours and day trips, grouped for
// readability (design/Questionnaire.dc.html). Same categories/values used by both
// TravelerProfilesPage (per-traveler preferences) and TripWizardPage (trip-level override).
export const PREFERENCE_GROUPS = [
  {
    name: 'Culture & sights',
    categories: [
      { key: 'history', label: 'History' },
      { key: 'culture', label: 'Culture', hint: 'e.g. local traditions, festivals, live performances' },
      { key: 'museums', label: 'Museums' },
      { key: 'architecture', label: 'Architecture' },
      { key: 'landmarks', label: 'Landmarks' },
      { key: 'photography', label: 'Photography' },
    ],
  },
  {
    name: 'Food & drink',
    categories: [
      { key: 'food', label: 'Food & Dining Activities' },
      { key: 'nightlife', label: 'Nightlife', hint: 'e.g. bars, clubs, live music venues' },
    ],
  },
  {
    name: 'Outdoors & activity',
    categories: [
      { key: 'nature', label: 'Nature', hint: 'e.g. parks, hiking, wildlife' },
      { key: 'beaches', label: 'Beaches' },
      { key: 'sports', label: 'Sports', hint: 'e.g. spectator sports, active/adventure sports' },
    ],
  },
  {
    name: 'Shopping & leisure',
    categories: [{ key: 'shopping', label: 'Shopping' }],
  },
  {
    name: 'Family & tours',
    categories: [
      {
        key: 'familyActivities',
        label: 'Family activities',
        hint: 'e.g. zoos, amusement parks, aquariums',
      },
      { key: 'guidedTours', label: 'Guided tours' },
      { key: 'dayTrips', label: 'Day trips', hint: 'e.g. nearby towns, day excursions outside the city' },
    ],
  },
];

export const PREFERENCE_CATEGORIES = PREFERENCE_GROUPS.flatMap((group) => group.categories);
