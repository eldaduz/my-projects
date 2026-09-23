import { describe, test, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { TripWizardPage } from './TripWizardPage';

function jsonResponse(status, body) {
  return {
    ok: status < 400,
    status,
    headers: { get: () => 'application/json' },
    json: async () => body,
  };
}

function renderWizard() {
  return render(
    <MemoryRouter initialEntries={['/trips/1']}>
      <Routes>
        <Route path="/trips/:id" element={<TripWizardPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('TripWizardPage', () => {
  let trip;
  let profiles;

  beforeEach(() => {
    trip = { id: '1', status: 'DRAFT', wizardStep: 1 };
    profiles = [];

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, options = {}) => {
        const method = options.method || 'GET';

        if (url === '/api/trips/1' && method === 'GET') {
          return jsonResponse(200, { trip });
        }

        if (url === '/api/traveler-profiles' && method === 'GET') {
          return jsonResponse(200, { profiles });
        }

        if (url === '/api/trips/1' && method === 'PATCH') {
          const body = JSON.parse(options.body);

          if (body.destination !== undefined && !body.destination?.trim()) {
            return jsonResponse(400, {
              error: { message: 'Destination is invalid.', code: 'INVALID_DESTINATION' },
            });
          }

          if (body.addTravelerProfileId !== undefined) {
            const profile = profiles.find((p) => p.id === body.addTravelerProfileId);
            const travelers = [
              ...(trip.tripProfile?.travelers ?? []),
              {
                id: `tt-${body.addTravelerProfileId}`,
                sourceTravelerProfileId: body.addTravelerProfileId,
                travelerName: profile?.travelerName,
                ageGroup: profile?.ageGroup,
              },
            ];
            trip = { ...trip, tripProfile: { ...trip.tripProfile, travelers } };
            return jsonResponse(200, { trip });
          }

          if (body.addTripOnlyTraveler !== undefined) {
            if (!body.addTripOnlyTraveler.travelerName) {
              return jsonResponse(400, {
                error: { message: 'Traveler name is required.', code: 'INVALID_TRAVELER_NAME' },
              });
            }
            const travelers = [
              ...(trip.tripProfile?.travelers ?? []),
              {
                id: `tt-only-${(trip.tripProfile?.travelers ?? []).length}`,
                ...body.addTripOnlyTraveler,
              },
            ];
            trip = { ...trip, tripProfile: { ...trip.tripProfile, travelers } };
            return jsonResponse(200, { trip });
          }

          if (body.removeTravelerId !== undefined) {
            const travelers = (trip.tripProfile?.travelers ?? []).filter(
              (t) => t.id !== body.removeTravelerId,
            );
            trip = { ...trip, tripProfile: { ...trip.tripProfile, travelers } };
            return jsonResponse(200, { trip });
          }

          if (body.addChildAge !== undefined) {
            const children = [
              ...(trip.tripProfile?.children ?? []),
              { id: `child-${(trip.tripProfile?.children ?? []).length}`, age: body.addChildAge },
            ];
            trip = {
              ...trip,
              tripProfile: { ...trip.tripProfile, children, childCount: children.length },
            };
            return jsonResponse(200, { trip });
          }

          if (
            body.accommodation !== undefined ||
            body.budgetLevel !== undefined ||
            body.paceOverride !== undefined ||
            body.preferences !== undefined ||
            body.hardConstraints !== undefined ||
            body.notes !== undefined
          ) {
            trip = {
              ...trip,
              ...(body.wizardStep !== undefined ? { wizardStep: body.wizardStep } : {}),
              tripProfile: {
                ...trip.tripProfile,
                ...(body.accommodation !== undefined
                  ? { accommodation: { ...trip.tripProfile?.accommodation, ...body.accommodation } }
                  : {}),
                ...(body.budgetLevel !== undefined ? { budgetLevel: body.budgetLevel } : {}),
                ...(body.paceOverride !== undefined ? { paceOverride: body.paceOverride } : {}),
                ...(body.preferences !== undefined ? { preferences: body.preferences } : {}),
                ...(body.hardConstraints !== undefined
                  ? { hardConstraints: body.hardConstraints }
                  : {}),
                ...(body.notes !== undefined ? { notes: body.notes } : {}),
              },
            };
            return jsonResponse(200, { trip });
          }

          if (body.markReadyForGeneration !== undefined) {
            if (trip.failReady) {
              return jsonResponse(400, {
                error: { message: 'Trip is not ready for generation yet.', code: 'TRIP_NOT_READY' },
              });
            }
            trip = { ...trip, status: 'READY_FOR_GENERATION' };
            return jsonResponse(200, { trip });
          }

          if (body.mustDo !== undefined) {
            trip = { ...trip, tripProfile: { ...trip.tripProfile, mustDo: body.mustDo } };
            return jsonResponse(200, { trip });
          }

          if (body.removeChildId !== undefined) {
            const children = (trip.tripProfile?.children ?? []).filter(
              (c) => c.id !== body.removeChildId,
            );
            trip = {
              ...trip,
              tripProfile: { ...trip.tripProfile, children, childCount: children.length },
            };
            return jsonResponse(200, { trip });
          }

          trip = { ...trip, ...body, duration: 5 };
          return jsonResponse(200, { trip });
        }

        if (url === '/api/trips/1' && method === 'DELETE') {
          if (trip.failDelete) {
            return jsonResponse(500, { error: { message: 'Something went wrong.' } });
          }
          return { ok: true, status: 204, headers: { get: () => null }, json: async () => null };
        }

        throw new Error(`Unhandled fetch: ${method} ${url}`);
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('shows the basics form for a fresh DRAFT trip', async () => {
    renderWizard();

    await waitFor(() => expect(screen.getByLabelText(/destination/i)).toBeInTheDocument());
  });

  test('saves trip basics and shows the summary', async () => {
    const user = userEvent.setup();
    renderWizard();
    await waitFor(() => expect(screen.getByLabelText(/destination/i)).toBeInTheDocument());

    await user.type(screen.getByLabelText(/destination/i), 'Lisbon');
    await user.type(screen.getByLabelText(/start date/i), '2026-09-01');
    await user.type(screen.getByLabelText(/end date/i), '2026-09-05');
    await user.click(screen.getByRole('button', { name: /save and continue/i }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Lisbon' })).toBeInTheDocument(),
    );
    expect(screen.queryByLabelText(/^destination$/i)).not.toBeInTheDocument();
  });

  test('shows a safe validation error without crashing', async () => {
    const user = userEvent.setup();
    renderWizard();
    await waitFor(() => expect(screen.getByLabelText(/destination/i)).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /save and continue/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/destination is invalid/i),
    );
  });

  test('resumes on the summary for an already-completed trip and allows editing', async () => {
    trip = {
      id: '1',
      status: 'DRAFT',
      wizardStep: 2,
      destination: 'Lisbon',
      startDate: '2026-09-01T00:00:00.000Z',
      endDate: '2026-09-05T00:00:00.000Z',
      duration: 5,
    };
    const user = userEvent.setup();
    renderWizard();

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Lisbon' })).toBeInTheDocument(),
    );
    expect(screen.queryByLabelText(/^destination$/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^edit$/i }));

    expect(screen.getByLabelText(/^destination$/i)).toHaveValue('Lisbon');
  });

  test('shows a safe error and stays on the page when delete fails', async () => {
    trip = {
      id: '1',
      status: 'DRAFT',
      wizardStep: 2,
      destination: 'Lisbon',
      startDate: '2026-09-01T00:00:00.000Z',
      endDate: '2026-09-05T00:00:00.000Z',
      duration: 5,
      failDelete: true,
    };
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderWizard();

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Lisbon' })).toBeInTheDocument(),
    );

    await user.click(screen.getByRole('button', { name: /delete trip/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/something went wrong/i),
    );
    expect(screen.getByRole('heading', { name: 'Lisbon' })).toBeInTheDocument();
    window.confirm.mockRestore();
  });

  test('lists reusable profiles to add once basics are saved, and adds one', async () => {
    trip = {
      id: '1',
      status: 'DRAFT',
      wizardStep: 2,
      destination: 'Lisbon',
      tripProfile: { travelers: [] },
    };
    profiles = [{ id: 'p1', profileName: 'My Partner', travelerName: 'Sam', ageGroup: 'adult' }];
    const user = userEvent.setup();
    renderWizard();

    await waitFor(() => expect(screen.getByText('My Partner')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(screen.getByText(/Sam \(adult\)/)).toBeInTheDocument());
    expect(screen.queryByText('My Partner')).not.toBeInTheDocument();
  });

  test('removes an added traveler', async () => {
    trip = {
      id: '1',
      status: 'DRAFT',
      wizardStep: 2,
      destination: 'Lisbon',
      tripProfile: {
        travelers: [{ id: 'tt1', sourceTravelerProfileId: 'p1', travelerName: 'Sam' }],
      },
    };
    profiles = [{ id: 'p1', profileName: 'My Partner', travelerName: 'Sam' }];
    const user = userEvent.setup();
    renderWizard();

    await waitFor(() => expect(screen.getByText('Sam')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /remove/i }));

    await waitFor(() => expect(screen.getByText('No travelers added yet.')).toBeInTheDocument());
  });

  test('adds a trip-only traveler without a saved profile', async () => {
    trip = { id: '1', status: 'DRAFT', wizardStep: 2, destination: 'Lisbon', tripProfile: {} };
    const user = userEvent.setup();
    renderWizard();

    await waitFor(() =>
      expect(screen.getByLabelText(/add a traveler without/i)).toBeInTheDocument(),
    );
    await user.type(screen.getByLabelText(/add a traveler without/i), 'Cousin Alex');
    await user.click(screen.getByRole('button', { name: 'Add traveler' }));

    await waitFor(() => expect(screen.getByText('Cousin Alex')).toBeInTheDocument());
  });

  test('adds and removes a child', async () => {
    trip = { id: '1', status: 'DRAFT', wizardStep: 2, destination: 'Lisbon', tripProfile: {} };
    const user = userEvent.setup();
    renderWizard();

    await waitFor(() => expect(screen.getByLabelText(/add a child/i)).toBeInTheDocument());
    await user.type(screen.getByLabelText(/add a child/i), '6');
    await user.click(screen.getByRole('button', { name: 'Add child' }));

    await waitFor(() => expect(screen.getByText('Age 6')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /remove/i }));

    await waitFor(() =>
      expect(screen.getByText('Not traveling with children.')).toBeInTheDocument(),
    );
  });

  test('saves trip questionnaire details and advances to the summary', async () => {
    trip = {
      id: '1',
      status: 'DRAFT',
      wizardStep: 3,
      destination: 'Lisbon',
      tripProfile: { travelers: [] },
    };
    const user = userEvent.setup();
    renderWizard();

    await waitFor(() => expect(screen.getByLabelText(/hotel already booked/i)).toBeInTheDocument());
    await user.selectOptions(screen.getByLabelText(/hotel already booked/i), 'yes');
    await user.type(screen.getByLabelText(/hotel name/i), 'Grand Hotel');
    await user.click(screen.getByLabelText(/Moderate —/));
    await user.click(screen.getByRole('button', { name: 'Save trip details' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^continue$/i })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: /^continue$/i }));

    await waitFor(() => expect(screen.getByText(/Yes — Grand Hotel/)).toBeInTheDocument());
    expect(screen.getByText(/moderate/)).toBeInTheDocument();
  });

  test('clears the stored hotel name after switching hotel booked back to no', async () => {
    trip = {
      id: '1',
      status: 'DRAFT',
      wizardStep: 4,
      destination: 'Lisbon',
      tripProfile: {
        travelers: [],
        accommodation: { hotelBooked: true, hotelName: 'Grand Hotel' },
      },
    };
    const user = userEvent.setup();
    renderWizard();

    await waitFor(() => expect(screen.getByText(/Yes — Grand Hotel/)).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Edit trip details' }));
    await user.selectOptions(screen.getByLabelText(/hotel already booked/i), 'no');
    await user.click(screen.getByRole('button', { name: 'Save trip details' }));
    await user.click(screen.getByRole('button', { name: 'Done' }));

    await waitFor(() => expect(screen.getByText(/^No$/)).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Edit trip details' }));
    await user.selectOptions(screen.getByLabelText(/hotel already booked/i), 'yes');

    expect(screen.getByLabelText(/hotel name/i)).toHaveValue('');
  });

  test('adds and removes a must-do item', async () => {
    trip = {
      id: '1',
      status: 'DRAFT',
      wizardStep: 3,
      destination: 'Lisbon',
      tripProfile: { travelers: [] },
    };
    const user = userEvent.setup();
    renderWizard();

    await waitFor(() => expect(screen.getByLabelText(/add a must-do item/i)).toBeInTheDocument());
    await user.type(screen.getByLabelText(/add a must-do item/i), 'Eiffel Tower');
    await user.click(screen.getByRole('button', { name: 'Add must-do' }));

    await waitFor(() => expect(screen.getByText('Eiffel Tower')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /remove/i }));

    await waitFor(() => expect(screen.getByText('No must-do items yet.')).toBeInTheDocument());
  });

  test('removing one of two identical must-do items keeps the other', async () => {
    trip = {
      id: '1',
      status: 'DRAFT',
      wizardStep: 3,
      destination: 'Lisbon',
      tripProfile: { travelers: [], mustDo: ['Eiffel Tower', 'Eiffel Tower'] },
    };
    const user = userEvent.setup();
    renderWizard();

    await waitFor(() => expect(screen.getAllByText('Eiffel Tower')).toHaveLength(2));

    const removeButtons = screen.getAllByRole('button', { name: /remove/i });
    await user.click(removeButtons[0]);

    await waitFor(() => expect(screen.getAllByText('Eiffel Tower')).toHaveLength(1));
  });

  test('resumes on the questionnaire summary once that step is complete', async () => {
    trip = {
      id: '1',
      status: 'DRAFT',
      wizardStep: 4,
      destination: 'Lisbon',
      tripProfile: { travelers: [], budgetLevel: 'premium', mustDo: ['Louvre'] },
    };
    renderWizard();

    await waitFor(() => expect(screen.getByText('premium')).toBeInTheDocument());
    expect(screen.queryByLabelText(/hotel already booked/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit trip details/i })).toBeInTheDocument();
  });

  test('resumes on the travelers summary once that step is complete', async () => {
    trip = {
      id: '1',
      status: 'DRAFT',
      wizardStep: 3,
      destination: 'Lisbon',
      tripProfile: {
        travelers: [{ id: 'tt1', sourceTravelerProfileId: 'p1', travelerName: 'Sam' }],
      },
    };
    renderWizard();

    await waitFor(() => expect(screen.getByText('Sam')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /^add$/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit travelers/i })).toBeInTheDocument();
  });

  test('re-editing basics after later steps are complete does not regress wizardStep', async () => {
    trip = {
      id: '1',
      status: 'DRAFT',
      wizardStep: 4,
      destination: 'Lisbon',
      startDate: '2026-09-01T00:00:00.000Z',
      endDate: '2026-09-05T00:00:00.000Z',
      duration: 5,
      tripProfile: { travelers: [{ id: 'tt1', travelerName: 'Sam' }] },
    };
    const user = userEvent.setup();
    renderWizard();

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Lisbon' })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: /^edit$/i }));
    await user.clear(screen.getByLabelText(/^destination$/i));
    await user.type(screen.getByLabelText(/^destination$/i), 'Porto');
    await user.click(screen.getByRole('button', { name: /save and continue/i }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Porto' })).toBeInTheDocument(),
    );
    // Travelers/questionnaire/review sections must still be visible as
    // summaries, not reset back to their entry forms.
    expect(screen.getByText('Sam')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit travelers/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /review & readiness/i })).toBeInTheDocument();
  });

  test('summarizes preferences, constraints, and notes on the trip details summary', async () => {
    trip = {
      id: '1',
      status: 'DRAFT',
      wizardStep: 4,
      destination: 'Lisbon',
      tripProfile: {
        travelers: [],
        preferences: { museums: 'interested', nightlife: 'block', food: 'neutral' },
        hardConstraints: 'No stairs',
        notes: 'Anniversary trip',
      },
    };
    renderWizard();

    await waitFor(() => expect(screen.getByText(/Museums \(interested\)/)).toBeInTheDocument());
    expect(screen.getByText(/Nightlife \(block\)/)).toBeInTheDocument();
    expect(screen.queryByText(/Food \(/)).not.toBeInTheDocument();
    expect(screen.getByText('No stairs')).toBeInTheDocument();
    expect(screen.getByText('Anniversary trip')).toBeInTheDocument();
  });

  test('summarizes the hotel area on the trip details summary', async () => {
    trip = {
      id: '1',
      status: 'DRAFT',
      wizardStep: 4,
      destination: 'Lisbon',
      tripProfile: {
        travelers: [],
        accommodation: { hotelBooked: true, hotelName: 'Grand Hotel', hotelArea: 'Old Town' },
      },
    };
    renderWizard();

    await waitFor(() => expect(screen.getByText(/Yes — Grand Hotel/)).toBeInTheDocument());
    expect(screen.getByText('Hotel address/area')).toBeInTheDocument();
    expect(screen.getByText('Old Town')).toBeInTheDocument();
  });

  test('shows the review & readiness section once the questionnaire step is complete, and marks ready', async () => {
    trip = {
      id: '1',
      status: 'DRAFT',
      wizardStep: 4,
      destination: 'Lisbon',
      tripProfile: { travelers: [{ id: 'tt1', travelerName: 'Sam' }] },
    };
    const user = userEvent.setup();
    renderWizard();

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /mark ready for generation/i })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: /mark ready for generation/i }));

    await waitFor(() => expect(screen.getByText(/ready for itinerary generation/i)).toBeInTheDocument());
    expect(
      screen.queryByRole('button', { name: /mark ready for generation/i }),
    ).not.toBeInTheDocument();
  });

  test('shows a safe error when marking ready fails', async () => {
    trip = {
      id: '1',
      status: 'DRAFT',
      wizardStep: 4,
      destination: 'Lisbon',
      tripProfile: { travelers: [] },
      failReady: true,
    };
    const user = userEvent.setup();
    renderWizard();

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /mark ready for generation/i })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: /mark ready for generation/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/not ready/i));
  });

  test('generates an itinerary once, shows synchronous loading, and restores action after failure', async () => {
    trip = {
      id: '1',
      status: 'READY_FOR_GENERATION',
      wizardStep: 4,
      destination: 'Lisbon',
      tripProfile: { travelers: [{ id: 'tt1', travelerName: 'Sam' }] },
    };
    let resolveGeneration;
    const generation = new Promise((resolve) => { resolveGeneration = resolve; });
    fetch.mockImplementation(async (url, options = {}) => {
      const method = options.method || 'GET';
      if (url === '/api/trips/1' && method === 'GET') return jsonResponse(200, { trip });
      if (url === '/api/traveler-profiles' && method === 'GET') return jsonResponse(200, { profiles });
      if (url === '/api/trips/1/generate-itinerary' && method === 'POST') {
        await generation;
        return jsonResponse(502, { error: { message: 'Generation failed safely.' } });
      }
      throw new Error(`Unhandled fetch: ${method} ${url}`);
    });
    const user = userEvent.setup();
    renderWizard();

    await waitFor(() => expect(screen.getByRole('button', { name: /generate itinerary/i })).toBeInTheDocument());
    const action = screen.getByRole('button', { name: /generate itinerary/i });
    await user.click(action);
    expect(screen.getByRole('button', { name: /generating itinerary/i })).toBeDisabled();
    expect(fetch).toHaveBeenCalledTimes(3);

    resolveGeneration();
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/generation failed safely/i));
    expect(screen.getByRole('button', { name: /generate itinerary/i })).not.toBeDisabled();
  });

  test('replaces the local trip after successful generation', async () => {
    trip = {
      id: '1',
      status: 'READY_FOR_GENERATION',
      wizardStep: 4,
      destination: 'Lisbon',
      tripProfile: { travelers: [{ id: 'tt1', travelerName: 'Sam' }] },
    };
    const generatedTrip = { ...trip, status: 'PLANNED', itineraryStatus: 'CURRENT' };
    fetch.mockImplementation(async (url, options = {}) => {
      const method = options.method || 'GET';
      if (url === '/api/trips/1' && method === 'GET') return jsonResponse(200, { trip });
      if (url === '/api/traveler-profiles' && method === 'GET') return jsonResponse(200, { profiles });
      if (url === '/api/trips/1/generate-itinerary' && method === 'POST') {
        return jsonResponse(200, { trip: generatedTrip });
      }
      throw new Error(`Unhandled fetch: ${method} ${url}`);
    });
    const user = userEvent.setup();
    renderWizard();

    await waitFor(() => expect(screen.getByRole('button', { name: /generate itinerary/i })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /generate itinerary/i }));

    await waitFor(() => expect(screen.getByText(/status: planned/i)).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /generate itinerary/i })).not.toBeInTheDocument();
  });

  test('replans an itinerary once, shows synchronous loading, and restores action after failure', async () => {
    trip = {
      id: '1',
      status: 'PLANNED',
      itineraryStatus: 'CURRENT',
      wizardStep: 4,
      destination: 'Lisbon',
      tripProfile: { travelers: [{ id: 'tt1', travelerName: 'Sam' }] },
      currentItinerary: { destination: 'Lisbon', days: [] },
    };
    let resolveReplan;
    const replan = new Promise((resolve) => { resolveReplan = resolve; });
    fetch.mockImplementation(async (url, options = {}) => {
      const method = options.method || 'GET';
      if (url === '/api/trips/1' && method === 'GET') return jsonResponse(200, { trip });
      if (url === '/api/traveler-profiles' && method === 'GET') return jsonResponse(200, { profiles });
      if (url === '/api/trips/1/replan-itinerary' && method === 'POST') {
        await replan;
        return jsonResponse(502, { error: { message: 'Replan failed safely.' } });
      }
      throw new Error(`Unhandled fetch: ${method} ${url}`);
    });
    const user = userEvent.setup();
    renderWizard();

    await waitFor(() => expect(screen.getByLabelText(/what would you like to change/i)).toBeInTheDocument());
    await user.type(screen.getByLabelText(/what would you like to change/i), 'Add more museums');
    const action = screen.getByRole('button', { name: /^replan itinerary$/i });
    await user.click(action);
    expect(screen.getByRole('button', { name: /replanning/i })).toBeDisabled();

    resolveReplan();
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/replan failed safely/i));
    expect(screen.getByRole('button', { name: /^replan itinerary$/i })).not.toBeDisabled();
  });

  test('replaces the local trip after successful replan and clears the instruction', async () => {
    trip = {
      id: '1',
      status: 'PLANNED',
      itineraryStatus: 'STALE',
      wizardStep: 4,
      destination: 'Lisbon',
      tripProfile: { travelers: [{ id: 'tt1', travelerName: 'Sam' }] },
      currentItinerary: { destination: 'Lisbon', days: [] },
    };
    const replannedTrip = { ...trip, itineraryStatus: 'CURRENT' };
    let lastBody;
    fetch.mockImplementation(async (url, options = {}) => {
      const method = options.method || 'GET';
      if (url === '/api/trips/1' && method === 'GET') return jsonResponse(200, { trip });
      if (url === '/api/traveler-profiles' && method === 'GET') return jsonResponse(200, { profiles });
      if (url === '/api/trips/1/replan-itinerary' && method === 'POST') {
        lastBody = JSON.parse(options.body);
        return jsonResponse(200, { trip: replannedTrip });
      }
      throw new Error(`Unhandled fetch: ${method} ${url}`);
    });
    const user = userEvent.setup();
    renderWizard();

    await waitFor(() => expect(screen.getByLabelText(/what would you like to change/i)).toBeInTheDocument());
    await user.type(screen.getByLabelText(/what would you like to change/i), 'Add more museums');
    await user.click(screen.getByRole('button', { name: /^replan itinerary$/i }));

    await waitFor(() => expect(lastBody).toEqual({ replanInstruction: 'Add more museums' }));
    await waitFor(() => expect(screen.getByLabelText(/what would you like to change/i)).toHaveValue(''));
  });

  test('does not offer replan while the trip is not PLANNED', async () => {
    trip = {
      id: '1',
      status: 'READY_FOR_GENERATION',
      wizardStep: 4,
      destination: 'Lisbon',
      tripProfile: { travelers: [{ id: 'tt1', travelerName: 'Sam' }] },
    };
    renderWizard();

    await waitFor(() => expect(screen.getByRole('button', { name: /generate itinerary/i })).toBeInTheDocument());
    expect(screen.queryByLabelText(/what would you like to change/i)).not.toBeInTheDocument();
  });

  test('does not show the review & readiness section before the questionnaire step is reached', async () => {
    trip = {
      id: '1',
      status: 'DRAFT',
      wizardStep: 3,
      destination: 'Lisbon',
      tripProfile: { travelers: [{ id: 'tt1', travelerName: 'Sam' }] },
    };
    renderWizard();

    await waitFor(() => expect(screen.getByText('Sam')).toBeInTheDocument());
    expect(
      screen.queryByRole('heading', { name: /review & readiness/i }),
    ).not.toBeInTheDocument();
  });
});
