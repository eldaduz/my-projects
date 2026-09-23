import { describe, test, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ItineraryView } from './ItineraryView';

function jsonResponse(status, body) {
  return {
    ok: status < 400,
    status,
    headers: { get: () => 'application/json' },
    json: async () => body,
  };
}

function makeItinerary() {
  return {
    destination: 'Rome',
    days: [
      {
        dayNumber: 1,
        date: '2026-09-01',
        title: 'Day one',
        summary: 'A first day.',
        activities: [
          {
            id: 'a1',
            period: 'MORNING',
            type: 'BREAKFAST',
            title: 'Breakfast',
            description: 'Coffee and pastry.',
            location: 'Cafe',
            durationMinutes: 45,
            transferBeforeMinutes: 0,
          },
        ],
      },
    ],
  };
}

function makeMultiDayItinerary() {
  return {
    destination: 'Rome',
    days: [
      {
        dayNumber: 1,
        date: '2026-09-01',
        title: 'Day one',
        summary: 'A first day.',
        activities: [
          {
            id: 'a1',
            period: 'MORNING',
            type: 'BREAKFAST',
            title: 'Breakfast',
            description: 'Coffee and pastry.',
            location: 'Cafe',
            durationMinutes: 45,
            transferBeforeMinutes: 0,
          },
          {
            id: 'a2',
            period: 'AFTERNOON',
            type: 'HISTORY',
            title: 'Colosseum',
            description: 'Guided tour.',
            location: 'Piazza del Colosseo',
            durationMinutes: 120,
            transferBeforeMinutes: 20,
          },
        ],
      },
      {
        dayNumber: 2,
        date: '2026-09-02',
        title: 'Day two',
        summary: 'A second day.',
        activities: [],
      },
    ],
  };
}

describe('ItineraryView', () => {
  let itinerary;
  let onUpdate;

  beforeEach(() => {
    itinerary = makeItinerary();
    onUpdate = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubFetch(handler) {
    vi.stubGlobal('fetch', vi.fn(handler));
  }

  test('shows the day, activity, and estimated time window', () => {
    stubFetch(async () => {
      throw new Error('no request expected');
    });
    render(<ItineraryView tripId="t1" itinerary={itinerary} onUpdate={onUpdate} />);

    expect(screen.getByText('Day one')).toBeInTheDocument();
    expect(screen.getByText('Breakfast')).toBeInTheDocument();
    expect(screen.getByText(/Est\. 08:00–08:45/)).toBeInTheDocument();
  });

  test('edits an activity and calls onUpdate with the returned trip', async () => {
    const user = userEvent.setup();
    const updatedTrip = { id: 't1', currentItinerary: makeItinerary() };
    updatedTrip.currentItinerary.days[0].activities[0].title = 'Breakfast (updated)';

    stubFetch(async (url, options) => {
      expect(url).toBe('/api/trips/t1/itinerary');
      expect(options.method).toBe('PATCH');
      const body = JSON.parse(options.body);
      expect(body).toMatchObject({ op: 'edit', activityId: 'a1' });
      return jsonResponse(200, { trip: updatedTrip });
    });

    render(<ItineraryView tripId="t1" itinerary={itinerary} onUpdate={onUpdate} />);

    await user.click(screen.getByRole('button', { name: /^edit$/i }));
    const titleInput = screen.getByLabelText(/^title$/i);
    await user.clear(titleInput);
    await user.type(titleInput, 'Breakfast (updated)');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith(updatedTrip));
  });

  test('deletes an activity after confirmation', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const updatedTrip = { id: 't1', currentItinerary: { ...makeItinerary(), days: [{ ...makeItinerary().days[0], activities: [] }] } };

    stubFetch(async (url, options) => {
      const body = JSON.parse(options.body);
      expect(body).toMatchObject({ op: 'delete', activityId: 'a1' });
      return jsonResponse(200, { trip: updatedTrip });
    });

    render(<ItineraryView tripId="t1" itinerary={itinerary} onUpdate={onUpdate} />);
    await user.click(screen.getByRole('button', { name: /delete/i }));

    expect(confirmSpy).toHaveBeenCalled();
    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith(updatedTrip));
  });

  test('does not delete when the confirmation is dismissed', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    stubFetch(async () => {
      throw new Error('no request expected when confirmation is dismissed');
    });

    render(<ItineraryView tripId="t1" itinerary={itinerary} onUpdate={onUpdate} />);
    await user.click(screen.getByRole('button', { name: /delete/i }));

    expect(onUpdate).not.toHaveBeenCalled();
  });

  test('adds an activity with a period to the active day', async () => {
    const user = userEvent.setup();
    const updatedTrip = { id: 't1', currentItinerary: makeItinerary() };
    updatedTrip.currentItinerary.days[0].activities.push({
      id: 'a2',
      period: 'AFTERNOON',
      type: 'FOOD',
      title: 'Gelato stop',
      description: 'Best gelato in town.',
      location: 'Piazza Navona',
      durationMinutes: 30,
      transferBeforeMinutes: 0,
    });

    stubFetch(async (url, options) => {
      const body = JSON.parse(options.body);
      expect(body).toMatchObject({
        op: 'add',
        dayNumber: 1,
        activity: { title: 'Gelato stop', type: 'FOOD', period: 'AFTERNOON', durationMinutes: 30 },
      });
      return jsonResponse(200, { trip: updatedTrip });
    });

    render(<ItineraryView tripId="t1" itinerary={itinerary} onUpdate={onUpdate} />);
    await user.click(screen.getByRole('button', { name: /add activity to this day/i }));

    const form = screen.getByRole('button', { name: /^add activity$/i }).closest('form');
    await user.type(within(form).getByLabelText(/title/i), 'Gelato stop');
    await user.type(within(form).getByLabelText(/description/i), 'Best gelato in town.');
    await user.type(within(form).getByLabelText(/location/i), 'Piazza Navona');
    await user.selectOptions(within(form).getByLabelText(/^type$/i), 'FOOD');
    await user.selectOptions(within(form).getByLabelText(/time of day/i), 'AFTERNOON');
    await user.type(within(form).getByLabelText(/duration/i), '30');
    await user.click(within(form).getByRole('button', { name: /^add activity$/i }));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith(updatedTrip));
  });

  test('shows a safe error and stays editable when the API rejects an edit', async () => {
    const user = userEvent.setup();
    stubFetch(async () =>
      jsonResponse(400, { error: { message: 'Activity type must be one of: ...', code: 'INVALID_ACTIVITY_TYPE' } }),
    );

    render(<ItineraryView tripId="t1" itinerary={itinerary} onUpdate={onUpdate} />);
    await user.click(screen.getByRole('button', { name: /^edit$/i }));
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/activity type must be one of/i),
    );
    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
  });

  test('switches active day and resets any open edit/add state', async () => {
    const user = userEvent.setup();
    itinerary.days.push({
      dayNumber: 2,
      date: '2026-09-02',
      title: 'Day two',
      summary: 'A second day.',
      activities: [],
    });
    stubFetch(async () => {
      throw new Error('no request expected');
    });

    render(<ItineraryView tripId="t1" itinerary={itinerary} onUpdate={onUpdate} />);
    await user.click(screen.getByRole('button', { name: /^edit$/i }));
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /day 2/i }));

    expect(screen.getByText('Day two')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save changes/i })).not.toBeInTheDocument();
  });

  test('reorders an activity later within its day', async () => {
    const user = userEvent.setup();
    const multiDay = makeMultiDayItinerary();
    const updatedTrip = { id: 't1', currentItinerary: makeMultiDayItinerary() };
    updatedTrip.currentItinerary.days[0].activities.reverse();

    stubFetch(async (url, options) => {
      const body = JSON.parse(options.body);
      expect(body).toMatchObject({ op: 'reorder', activityId: 'a1', direction: 'later' });
      return jsonResponse(200, { trip: updatedTrip });
    });

    render(<ItineraryView tripId="t1" itinerary={multiDay} onUpdate={onUpdate} />);
    await user.click(screen.getByRole('button', { name: /move breakfast later/i }));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith(updatedTrip));
  });

  test('disables the earlier/later arrows at day boundaries', () => {
    const multiDay = makeMultiDayItinerary();
    stubFetch(async () => {
      throw new Error('no request expected');
    });

    render(<ItineraryView tripId="t1" itinerary={multiDay} onUpdate={onUpdate} />);

    expect(screen.getByRole('button', { name: /move breakfast earlier/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /move colosseum later/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /move breakfast later/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /move colosseum earlier/i })).toBeEnabled();
  });

  test('moves an activity to another day via the move-to-day select', async () => {
    const user = userEvent.setup();
    const multiDay = makeMultiDayItinerary();
    const updatedTrip = { id: 't1', currentItinerary: makeMultiDayItinerary() };
    const [moved] = updatedTrip.currentItinerary.days[0].activities.splice(0, 1);
    updatedTrip.currentItinerary.days[1].activities.push(moved);

    stubFetch(async (url, options) => {
      const body = JSON.parse(options.body);
      expect(body).toMatchObject({ op: 'move', activityId: 'a1', toDayNumber: 2 });
      return jsonResponse(200, { trip: updatedTrip });
    });

    render(<ItineraryView tripId="t1" itinerary={multiDay} onUpdate={onUpdate} />);
    await user.selectOptions(
      screen.getByLabelText(/move breakfast to a different day/i),
      'Day 2',
    );

    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith(updatedTrip));
  });

  test('does not offer moving an activity to the day it is already on', () => {
    const multiDay = makeMultiDayItinerary();
    stubFetch(async () => {
      throw new Error('no request expected');
    });

    render(<ItineraryView tripId="t1" itinerary={multiDay} onUpdate={onUpdate} />);

    const moveSelect = screen.getByLabelText(/move breakfast to a different day/i);
    expect(within(moveSelect).queryByRole('option', { name: 'Day 1' })).not.toBeInTheDocument();
    expect(within(moveSelect).getByRole('option', { name: 'Day 2' })).toBeInTheDocument();
  });
});
